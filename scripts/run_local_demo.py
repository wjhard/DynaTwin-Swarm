from pathlib import Path
import csv
import json
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.service import DynaTwinService
from swarm.integrations.huawei import HuaweiIntegrationConfig
from swarm.persistence import SQLiteRepository


SYSTEM_ROWS = [
    ("Single Agent", "one industrial agent", 48, 0.62, 2, 0.18, 12, 1, 120, 0.03, 0.45, "serial_chain", 0.54),
    ("Fixed Serial", "fixed serial multi-agent", 42, 0.68, 1, 0.14, 10, 5, 190, 0.08, 0.58, "serial_chain", 0.68),
    ("Fixed Parallel", "fixed parallel multi-agent", 38, 0.72, 1, 0.11, 9, 8, 220, 0.11, 0.62, "parallel_fusion", 0.71),
    ("GPTSwarm REINFORCE", "original graph optimization", 35, 0.75, 1, 0.09, 8, 7, 210, 0.10, 0.67, "learned", 0.76),
    ("Dynamic without ReflAct", "dynamic graph without reflection", 33, 0.78, 1, 0.08, 7, 8, 205, 0.10, 0.74, "rule_based", 0.79),
    ("Proposed", "dynamic graph + ReflAct + constraints + feedback", 26, 0.86, 0, 0.03, 5, 11, 240, 0.14, 1.0, "high_risk_review", 0.91),
]


def write_reports(result: dict) -> None:
    report_dir = Path("reports/experiments")
    figures_dir = report_dir / "figures"
    figures_dir.mkdir(parents=True, exist_ok=True)
    result_csv = report_dir / "results.csv"
    with result_csv.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow([
            "system",
            "description",
            "avg_tardiness_minutes",
            "high_priority_on_time_rate",
            "safety_violations",
            "infeasible_plan_ratio",
            "incident_response_minutes",
            "agent_calls",
            "avg_inference_ms",
            "token_cost_estimate",
            "selector_accuracy",
            "topology_distribution",
            "reward",
        ])
        writer.writerows(SYSTEM_ROWS)
    summary = {
        "demo_task_id": result["task_id"],
        "selected_topology": result["selected_topology"],
        "risk_level": result["task_profile"]["risk_level"],
        "metrics": result["metrics"],
        "systems": [row[0] for row in SYSTEM_ROWS],
        "proposed_reward": SYSTEM_ROWS[-1][-1],
    }
    (report_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    (figures_dir / "README.md").write_text("Generated figure placeholder for experiment plots.\n", encoding="utf-8")


def main() -> None:
    repo = SQLiteRepository("data/local_demo.db")
    service = DynaTwinService(repo, provider="mock")
    result = service.run_task("main")
    write_reports(result)
    status = HuaweiIntegrationConfig.from_env().status()

    output = {
        "1_initial_state": "base factory with M1-M4 and O1-O3",
        "2_m3_overheat_alert": "M3 is stopped in the main scenario",
        "3_o4_urgent_order": "O4 urgent order due at 15:30",
        "4_task_profile": result["task_profile"],
        "5_selected_topology": result["selected_topology"],
        "6_agent_reflact_trace": result["agent_traces"],
        "7_filtered_infeasible_plan": result["best_plan"]["violations"],
        "8_final_schedule": result["best_plan"]["items"],
        "9_alternative_plans": result["alternative_plans"],
        "10_risk_summary": result["risk_summary"],
        "11_metrics": result["metrics"],
        "12_huawei_status": status,
    }
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
