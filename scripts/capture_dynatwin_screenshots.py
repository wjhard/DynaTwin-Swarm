from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import requests
from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "screenshots"
API = "http://127.0.0.1:8010"
FRONTEND = "http://127.0.0.1:5174/"


def api(method: str, path: str, payload: dict[str, Any] | None = None, timeout: int = 90) -> dict[str, Any]:
    url = f"{API}{path}"
    response = requests.request(method, url, json=payload, timeout=timeout)
    response.raise_for_status()
    if response.content:
        return response.json()
    return {}


def wait_for_backend() -> None:
    deadline = time.time() + 60
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            api("GET", "/health", timeout=5)
            return
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            time.sleep(1)
    raise RuntimeError(f"Backend not ready: {last_error}")


def wait_for_frontend(page: Page) -> None:
    page.goto(FRONTEND, wait_until="networkidle", timeout=60_000)
    page.wait_for_selector(".big-screen", timeout=60_000)
    page.wait_for_timeout(1800)


def screenshot_page(page: Page, name: str) -> None:
    page.screenshot(path=str(OUT / name), full_page=True)


def screenshot_element(page: Page, selector: str, name: str) -> None:
    try:
        locator = page.locator(selector).first
        locator.wait_for(state="visible", timeout=12_000)
        locator.screenshot(path=str(OUT / name))
    except PlaywrightTimeoutError:
        screenshot_page(page, name)


def click_dataset(page: Page, keyword: str) -> bool:
    buttons = page.locator(".dataset-buttons button")
    try:
        buttons.first.wait_for(state="visible", timeout=20_000)
        count = buttons.count()
        for idx in range(count):
            button = buttons.nth(idx)
            text = button.inner_text(timeout=3_000)
            if keyword.lower() in text.lower():
                button.click(timeout=10_000)
                page.wait_for_function(
                    "() => !document.querySelector('.dataset-buttons button[disabled]')",
                    timeout=90_000,
                )
                page.wait_for_timeout(1200)
                return True
    except Exception:  # noqa: BLE001
        return False
    return False


def render_a2c_overlay(page: Page, data: dict[str, Any]) -> None:
    page.evaluate(
        """
        (payload) => {
          const history = payload.history || [];
          const probabilities = payload.probabilities || {};
          const existing = document.querySelector('#a2c-doc-overlay');
          if (existing) existing.remove();
          const panel = document.createElement('div');
          panel.id = 'a2c-doc-overlay';
          panel.style.position = 'absolute';
          panel.style.left = '260px';
          panel.style.top = '170px';
          panel.style.width = '1320px';
          panel.style.height = '650px';
          panel.style.zIndex = '9999';
          panel.style.background = 'rgba(4,14,36,0.96)';
          panel.style.border = '1px solid rgba(0,212,255,0.45)';
          panel.style.borderRadius = '12px';
          panel.style.boxShadow = '0 0 42px rgba(0,212,255,0.18)';
          panel.style.padding = '28px';
          panel.style.color = '#E8F4FF';
          panel.style.fontFamily = 'Arial, Microsoft YaHei, sans-serif';

          const rewards = history.map((item) => Number(item.reward || 0));
          const min = Math.min(...rewards, -0.5);
          const max = Math.max(...rewards, 1);
          const points = history.map((item, i) => {
            const x = 70 + (i / Math.max(1, history.length - 1)) * 760;
            const y = 450 - ((Number(item.reward || 0) - min) / Math.max(0.001, max - min)) * 310;
            return `${x},${y}`;
          }).join(' ');
          const bars = Object.entries(probabilities).map(([name, value], i) => {
            const pct = Math.round(Number(value) * 100);
            const y = 150 + i * 66;
            const color = ['#00D4FF', '#7B61FF', '#3B82F6', '#FFB800', '#8FB4D4'][i % 5];
            return `
              <text x="925" y="${y - 8}" fill="#E8F4FF" font-size="21" font-weight="700">${name}</text>
              <rect x="925" y="${y + 10}" width="270" height="16" rx="8" fill="#183B63"/>
              <rect x="925" y="${y + 10}" width="${270 * pct / 100}" height="16" rx="8" fill="${color}"/>
              <text x="1225" y="${y + 25}" fill="${color}" font-size="20" font-weight="700">${pct}%</text>
            `;
          }).join('');
          panel.innerHTML = `
            <div style="font-size:34px;font-weight:800;color:#00D4FF;margin-bottom:8px;">A2C强化学习训练结果</div>
            <div style="font-size:18px;color:#8FB4D4;margin-bottom:20px;">训练奖励曲线与拓扑选择概率分布</div>
            <svg width="1260" height="520" viewBox="0 0 1260 520">
              <g>
                <text x="45" y="38" fill="#8FB4D4" font-size="17">Reward / Episode</text>
                <line x1="70" y1="450" x2="850" y2="450" stroke="#24577F" stroke-width="2"/>
                <line x1="70" y1="110" x2="70" y2="450" stroke="#24577F" stroke-width="2"/>
                <g stroke="#123B60" stroke-width="1">
                  <line x1="70" y1="365" x2="850" y2="365"/>
                  <line x1="70" y1="280" x2="850" y2="280"/>
                  <line x1="70" y1="195" x2="850" y2="195"/>
                  <line x1="70" y1="110" x2="850" y2="110"/>
                </g>
                <polyline points="${points}" fill="none" stroke="#00D4FF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
                ${history.map((item, i) => {
                  const x = 70 + (i / Math.max(1, history.length - 1)) * 760;
                  const y = 450 - ((Number(item.reward || 0) - min) / Math.max(0.001, max - min)) * 310;
                  return `<circle cx="${x}" cy="${y}" r="5" fill="#00FF88"/>`;
                }).join('')}
                <text x="70" y="486" fill="#8FB4D4" font-size="16">Episode 1</text>
                <text x="765" y="486" fill="#8FB4D4" font-size="16">Episode ${history.length || 20}</text>
              </g>
              <g>
                <text x="925" y="72" fill="#00D4FF" font-size="28" font-weight="800">拓扑概率分布</text>
                ${bars}
              </g>
            </svg>
          `;
          document.body.appendChild(panel);
        }
        """,
        data,
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    wait_for_backend()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)

        api("POST", "/api/demo/reset")
        api("POST", "/api/datasets/public/la40/run", timeout=120)
        wait_for_frontend(page)
        screenshot_page(page, "01_dashboard_normal.png")
        screenshot_element(page, ".ai-panel", "02_topology_graph.png")

        api("POST", "/api/demo/reset")
        api("POST", "/api/tasks/run", {"scenario": "main"})
        wait_for_frontend(page)
        screenshot_page(page, "03_before_failure.png")

        api("POST", "/api/simulation/scenario", {"scenario": "random_failure"}, timeout=120)
        page.wait_for_timeout(3000)
        wait_for_frontend(page)
        screenshot_page(page, "04_after_failure.png")
        screenshot_element(page, ".machine-list", "05_recovery_countdown.png")

        wait_for_frontend(page)
        clicked_ft06 = click_dataset(page, "FT06")
        clicked_la40 = click_dataset(page, "LA40")
        if not (clicked_ft06 and clicked_la40):
            # Keep repository state valid even if a frontend button was obscured.
            api("POST", "/api/datasets/public/jsplib_ft06/run", timeout=120)
            api("POST", "/api/datasets/public/la40/run", timeout=120)
            wait_for_frontend(page)
        screenshot_element(page, ".benchmark-panel", "06_benchmark_results.png")

        a2c = api("POST", "/api/experiments/run_a2c", timeout=120)
        wait_for_frontend(page)
        render_a2c_overlay(page, a2c)
        page.locator("#a2c-doc-overlay").screenshot(path=str(OUT / "07_a2c_training.png"))

        browser.close()

    print(json.dumps({"screenshots": sorted(path.name for path in OUT.glob("*.png"))}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
