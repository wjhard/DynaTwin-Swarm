import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import "echarts-gl";
import {
  BorderBox1,
  BorderBox8,
  BorderBox11,
  BorderBox12,
  BorderBox13,
  Decoration3,
  Decoration5,
  Decoration6,
  DigitalFlop,
  ScrollBoard,
} from "@jiaminghi/data-view-react";
import "./styles.css";

type Machine = {
  id: string;
  name: string;
  status: string;
  temperature_c: number;
  current_order_id?: string | null;
  efficiency?: number;
};
type Operation = {
  id: string;
  required_capability?: string;
  duration_minutes?: number;
  needs_reassignment?: boolean;
};
type Order = {
  id: string;
  priority: string;
  due_minute: number;
  operations: Operation[];
};
type AlertItem = {
  severity?: string;
  message?: string;
  machine_id?: string;
  minute?: number;
};
type EventItem = {
  type?: string;
  machine_id?: string;
  message?: string;
  minute?: number;
};
type FactoryState = {
  now_minute?: number;
  machines?: Machine[];
  orders?: Order[];
  alerts?: AlertItem[];
  events?: EventItem[];
  materials?: { id: string; name: string; quantity: number; reserved?: number; unit?: string }[];
  recovery_schedule?: Record<string, number>;
  metadata?: Record<string, unknown>;
};
type ScheduleItem = {
  order_id: string;
  operation_id: string;
  machine_id: string;
  start_minute: number;
  end_minute: number;
};
type Trace = {
  agent_name: string;
  decision: {
    current_state?: string;
    goal?: string;
    gap?: string;
    risk_level?: string;
    recommended_action?: string;
    confidence?: number;
  };
};
type RunResult = {
  state?: FactoryState;
  selected_topology?: string;
  topology_selection?: { topology_name?: string; reason?: string; confidence?: number };
  task_profile?: Record<string, unknown>;
  agent_traces?: Trace[];
  best_plan?: { items?: ScheduleItem[]; metrics?: Record<string, unknown> };
  metrics?: Record<string, unknown>;
};
type PublicDataset = {
  id: string;
  name: string;
  source?: string;
  description?: string;
  machine_count: number;
  job_count: number;
  operation_count: number;
  best_known_makespan?: number | null;
  optimal?: number | null;
};
type BenchmarkRow = {
  id: string;
  datasetName: string;
  makespan: number;
  topology: string;
  solveTimeMs: number;
  bestKnown?: number | null;
};
type ExperimentPayload = {
  history?: { episode?: number; reward?: number; topology?: string }[];
  probabilities?: Record<string, number>;
  baselines?: { system?: string; description?: string; reward?: number }[];
};
type LogEntry = {
  id: string;
  ts: string;
  agent: string;
  action: string;
  risk: string;
};
type Notice = { id: string; type: "success" | "warning" | "error" | "info"; message: string };

const API = (import.meta.env.VITE_API_BASE || "http://127.0.0.1:8010").replace(/\/$/, "");
const MACHINE_COLORS = ["#00D4FF", "#00FFB2", "#2A7BFF", "#8A5CFF", "#FFB800", "#FF6B35", "#5CE1E6", "#3DDC97"];
const AGENT_COLORS = ["#00D4FF", "#00FF88", "#FFB800", "#FF6B35", "#9C6CFF", "#5CE1E6"];

const topologyLabel: Record<string, string> = {
  serial_chain: "串行链",
  parallel_fusion: "并行汇聚",
  hierarchical_tree: "层级树",
  supervisor_tree: "层级树",
  full_mesh: "全连接",
  fully_connected: "全连接",
  high_risk_review: "高风险审查",
};
const riskLabel: Record<string, string> = {
  low: "低风险",
  normal: "正常",
  medium: "中风险",
  high: "高风险",
  critical: "极高风险",
};
const machineStatusLabel: Record<string, string> = {
  available: "可用",
  busy: "运行中",
  failed: "故障",
  maintenance: "维护",
};
const priorityLabel: Record<string, string> = {
  normal: "普通",
  high: "高优先",
  urgent: "紧急",
};
const serviceLabel: Record<string, string> = {
  PanguLM: "盘古大模型",
  MindIE: "MindIE",
  GaussDB: "GaussDB",
  OBS: "OBS",
  IoTDA: "IoTDA",
  EventGrid: "EventGrid",
  FunctionGraph: "FunctionGraph",
  ModelArts: "ModelArts",
};

async function getJson(path: string) {
  const response = await fetch(`${API}${path}`);
  if (!response.ok) throw new Error("数据加载失败");
  return response.json();
}

async function postJson(path: string, body: unknown = {}) {
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("请求失败");
  return response.json();
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateTime(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatMinute(minute: number) {
  const base = 8 * 60 + minute;
  return `${pad(Math.floor(base / 60) % 24)}:${pad(base % 60)}`;
}

function sanitize(value?: unknown): string {
  return String(value ?? "暂无").replace(/\bmock\s*:\s*/gi, "").replace(/\bfallback\s*:\s*/gi, "").trim();
}

function translateAction(value?: unknown): string {
  const text = sanitize(value);
  const rules: { match: RegExp; value: string }[] = [
    { match: /route to high_risk_review/i, value: "切换至高风险审查拓扑，隔离异常设备后重排" },
    { match: /route to parallel/i, value: "进入并行分析拓扑，多智能体同步评估" },
    { match: /invoke cp-sat/i, value: "调用 CP-SAT 约束求解器生成最优排程" },
    { match: /freeze unsafe machine/i, value: "冻结不安全设备并发布告警" },
    { match: /remove.*candidate machine/i, value: "从候选资源中移除故障设备" },
    { match: /reject any plan using failed/i, value: "拒绝使用故障设备的排程方案" },
    { match: /validate machine capacity/i, value: "校验设备能力、库存、工序先后和安全约束" },
    { match: /report selected topology/i, value: "汇总拓扑、智能体决策和最终排程报告" },
    { match: /resolve material shortage/i, value: "处理物料短缺和资源冲突" },
    { match: /no safety freeze required/i, value: "当前无需安全冻结，可继续调度" },
  ];
  return rules.find((rule) => rule.match.test(text))?.value ?? text;
}

function canonicalAgent(name: string) {
  return name.replace(/Agent$/, "").replace("FinalDecision", "Critic");
}

function planMakespan(items: ScheduleItem[], metrics?: Record<string, unknown>) {
  const metric = Number(metrics?.makespan);
  return Number.isFinite(metric) && metric > 0 ? metric : Math.max(0, ...items.map((item) => item.end_minute));
}

function riskLevel(state: FactoryState | null, orders: Order[], result: RunResult | null): string {
  const failedCount = (state?.machines ?? []).filter((machine) => machine.status === "failed").length;
  const alertCount = state?.alerts?.length ?? 0;
  const urgentCount = orders.filter((order) => ["urgent", "high"].includes(order.priority)).length;
  if (failedCount >= 2) return "critical";
  if (failedCount >= 1 || alertCount >= 3) return "high";
  if (urgentCount >= 1 || alertCount >= 1) return "medium";
  const risk = result?.task_profile?.risk_level;
  return typeof risk === "string" ? risk : "low";
}

function riskColor(risk: string) {
  if (risk === "critical" || risk === "high") return "#FF4444";
  if (risk === "medium") return "#FFB800";
  return "#00FF88";
}

function oeeColor(value: number) {
  if (value >= 85) return "#00FF88";
  if (value >= 70) return "#FFB800";
  return "#FF4444";
}

function machineLoad(machine: Machine) {
  if (machine.status === "failed") return 12;
  if (machine.status === "busy") return Math.max(35, Math.round((machine.efficiency ?? 0.86) * 100));
  return Math.max(24, Math.round((machine.efficiency ?? 0.72) * 70));
}

function machineColor(machine: Machine) {
  if (machine.status === "failed") return "#FF4444";
  if (machine.status === "busy") return "#2A7BFF";
  return "#00D4FF";
}

function factoryMachineGradient(status: string) {
  if (status === "failed") return "#FF4444";
  if (status === "busy") return "#2A7BFF";
  return "#00FFFF";
}

function serviceConnected(value: unknown) {
  const text = String(value ?? "").toLowerCase();
  return Boolean(text) && !["false", "offline", "disconnected", "disabled", "error", "none"].some((token) => text.includes(token));
}

function useScreenScale() {
  const [scale, setScale] = useState(() => window.innerWidth / 1920);
  useEffect(() => {
    const update = () => setScale(window.innerWidth / 1920);
    window.addEventListener("resize", update);
    update();
    return () => window.removeEventListener("resize", update);
  }, []);
  return scale;
}

function PanelTitle({ title }: { title: string }) {
  return (
    <div className="panel-title">
      <Decoration3 className="panel-title-decoration" />
      <span>{title}</span>
      <i />
    </div>
  );
}

function DigitalMetric({ label, value, suffix = "", color }: { label: string; value: number; suffix?: string; color: string }) {
  return (
    <div className="digital-metric">
      <DigitalFlop
        config={{
          number: [Number.isFinite(value) ? value : 0],
          content: `{nt}${suffix}`,
          toFixed: 0,
          style: {
            fontSize: 34,
            fill: color,
            fontFamily: "Courier New",
            fontWeight: "bold",
          },
        }}
      />
      <p>{label}</p>
    </div>
  );
}

function MachineRow({ machine, nowMinute, recoveryMinute }: { machine: Machine; nowMinute: number; recoveryMinute?: number }) {
  const failed = machine.status === "failed";
  const hot = machine.temperature_c > 85;
  const danger = machine.temperature_c > 90;
  const recovery = failed && recoveryMinute !== undefined ? Math.max(0, Math.ceil(recoveryMinute - nowMinute)) : null;
  return (
    <div className={`machine-row ${machine.status}`}>
      <span className={`machine-dot ${machine.status}`} />
      <div className="machine-info">
        <strong>{machine.id}</strong>
        <span>{machine.name}</span>
        {recovery !== null && <em>预计 {recovery} 分钟后自动恢复</em>}
      </div>
      <div className={`machine-temp ${danger ? "danger" : hot ? "hot" : ""}`}>{Math.round(machine.temperature_c)}°C</div>
    </div>
  );
}

function NoticeStack({ notices, onClose }: { notices: Notice[]; onClose: (id: string) => void }) {
  return (
    <div className="notice-stack">
      {notices.map((notice) => (
        <button key={notice.id} className={`notice ${notice.type}`} onClick={() => onClose(notice.id)}>
          {notice.message}
        </button>
      ))}
    </div>
  );
}

function App() {
  const scale = useScreenScale();
  const [state, setState] = useState<FactoryState | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [datasets, setDatasets] = useState<PublicDataset[]>([]);
  const [benchRows, setBenchRows] = useState<BenchmarkRow[]>([]);
  const [experiment, setExperiment] = useState<ExperimentPayload | null>(null);
  const [integrations, setIntegrations] = useState<Record<string, unknown>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [clock, setClock] = useState(formatDateTime());
  const [autoRunning, setAutoRunning] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [runningDataset, setRunningDataset] = useState<string | null>(null);
  const autoRef = useRef<number | null>(null);
  const latestRecoveryEventRef = useRef("");

  const allOrders = useMemo(() => state?.orders ?? result?.state?.orders ?? [], [state, result]);
  const machines = useMemo(() => state?.machines ?? result?.state?.machines ?? [], [state, result]);
  const scheduleItems = useMemo(() => result?.best_plan?.items ?? [], [result]);
  const makespan = useMemo(() => planMakespan(scheduleItems, result?.best_plan?.metrics), [scheduleItems, result]);
  const traces = useMemo(() => result?.agent_traces ?? [], [result]);
  const topology = useMemo(
    () => result?.selected_topology ?? result?.topology_selection?.topology_name ?? String(state?.metadata?.selected_topology ?? "parallel_fusion"),
    [result, state]
  );
  const risk = useMemo(() => riskLevel(state, allOrders, result), [state, allOrders, result]);
  const urgentOrders = useMemo(() => allOrders.filter((order) => ["urgent", "high"].includes(order.priority)), [allOrders]);
  const normalMachineCount = useMemo(() => machines.filter((machine) => machine.status !== "failed").length, [machines]);
  const recoverySchedule = useMemo(() => {
    const raw = state?.metadata?.recovery_schedule ?? state?.recovery_schedule ?? {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {} as Record<string, number>;
    return Object.fromEntries(Object.entries(raw as Record<string, unknown>).map(([key, value]) => [key, Number(value)]));
  }, [state]);
  const oee = useMemo(() => {
    if (!machines.length) return { availability: 0, performance: 0, oee: 0 };
    const availability = machines.filter((machine) => machine.status !== "failed").length / machines.length;
    const performance =
      machines.reduce((sum, machine) => {
        const temp = machine.temperature_c;
        return sum + (machine.status === "failed" ? 0 : temp > 90 ? 0.5 : temp > 80 ? 0.75 : temp > 70 ? 0.85 : 0.95);
      }, 0) / machines.length;
    return {
      availability: Math.round(availability * 100),
      performance: Math.round(performance * 100),
      oee: Math.round(availability * performance * 0.96 * 100),
    };
  }, [machines]);

  function notify(type: Notice["type"], message: string) {
    const id = Math.random().toString(36).slice(2);
    setNotices((previous) => [...previous, { id, type, message }].slice(-4));
    setTimeout(() => setNotices((previous) => previous.filter((notice) => notice.id !== id)), 5000);
  }

  function addLog(agent: string, action: string, riskLevelValue: string) {
    setLogs((previous) => [
      ...previous.slice(-19),
      {
        id: Math.random().toString(36).slice(2),
        ts: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
        agent,
        action: translateAction(action),
        risk: riskLevelValue,
      },
    ]);
  }

  function applyResult(data: RunResult) {
    setResult(data);
    if (data.state) setState(data.state);
    if (data.agent_traces) {
      data.agent_traces.forEach((trace) =>
        addLog(canonicalAgent(trace.agent_name), trace.decision.recommended_action ?? "", trace.decision.risk_level ?? "low")
      );
    }
  }

  function applyTickResponse(data: RunResult | FactoryState | null | undefined) {
    if (!data) return;
    const payload = data as RunResult;
    const hasRunPayload = Boolean(payload.agent_traces || payload.best_plan?.items || payload.selected_topology || payload.topology_selection);
    if (hasRunPayload) {
      setResult((previous) => ({
        ...(previous ?? {}),
        ...payload,
        best_plan: payload.best_plan ?? previous?.best_plan,
        agent_traces: payload.agent_traces ?? previous?.agent_traces ?? [],
      }));
      if (payload.state) setState(payload.state);
      if (payload.agent_traces) {
        payload.agent_traces.forEach((trace) =>
          addLog(canonicalAgent(trace.agent_name), trace.decision.recommended_action ?? "", trace.decision.risk_level ?? "low")
        );
      }
      return;
    }
    const maybeState = data as FactoryState;
    if (payload.state) setState(payload.state);
    else if (maybeState.machines || maybeState.orders || maybeState.alerts || maybeState.events) setState(maybeState);
  }

  async function refreshLatestState() {
    const latest = await getJson("/api/state");
    setState(latest);
    return latest as FactoryState;
  }

  useEffect(() => {
    (async () => {
      try {
        const [latestState, traceResult, scheduleResult, topologyResult, datasetResult, integrationResult, experimentResult] = await Promise.all([
          getJson("/api/state").catch(() => null),
          getJson("/api/traces/latest").catch(() => null),
          getJson("/api/schedules/latest").catch(() => null),
          getJson("/api/topology/latest").catch(() => null),
          getJson("/api/datasets/public").catch(() => ({ datasets: [] })),
          getJson("/api/integrations/status").catch(() => ({ status: {} })),
          getJson("/api/experiments/latest").catch(() => null),
        ]);
        if (latestState && Object.keys(latestState).length) setState(latestState);
        if (traceResult?.agent_traces || scheduleResult?.items || topologyResult?.topology_name) {
          setResult({
            agent_traces: traceResult?.agent_traces ?? [],
            best_plan: scheduleResult?.items ? scheduleResult : undefined,
            selected_topology: topologyResult?.topology_name,
            topology_selection: topologyResult?.topology_name ? topologyResult : undefined,
          });
        }
        if (datasetResult?.datasets) setDatasets(datasetResult.datasets);
        if (integrationResult?.status) setIntegrations(integrationResult.status);
        if (experimentResult) setExperiment(experimentResult);
      } catch {
        notify("error", "数据加载失败，请检查后端服务");
      }
    })();
    const clockTimer = window.setInterval(() => setClock(formatDateTime()), 1000);
    return () => window.clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    if (autoRunning) {
      autoRef.current = window.setInterval(async () => {
        try {
          const data = await postJson("/api/simulation/tick", { force_reschedule: false });
          applyTickResponse(data);
        } catch {
          notify("error", "自动刷新失败，请检查后端服务");
        }
      }, 8000);
    } else if (autoRef.current) {
      window.clearInterval(autoRef.current);
    }
    return () => {
      if (autoRef.current) window.clearInterval(autoRef.current);
    };
  }, [autoRunning]);

  useEffect(() => {
    const recovery = [...(state?.events ?? [])].reverse().find((event) => event.type === "machine_recovered" && event.machine_id);
    if (!recovery?.machine_id) return;
    const key = `${recovery.machine_id}-${recovery.minute ?? ""}-${recovery.message ?? ""}`;
    if (!latestRecoveryEventRef.current) {
      latestRecoveryEventRef.current = key;
      return;
    }
    if (latestRecoveryEventRef.current !== key) {
      latestRecoveryEventRef.current = key;
      notify("success", `✅ ${recovery.machine_id} 已自动恢复，AI正在重新优化排程`);
    }
  }, [state?.events]);

  async function triggerScenario(scenario: "random_failure" | "random_order" | "composite") {
    setLoadingAction(scenario);
    try {
      const data = await postJson("/api/simulation/scenario", { scenario });
      applyResult(data);
      await refreshLatestState();
      if (scenario === "random_failure") notify("error", "🔴 已触发随机设备故障，系统正在隔离并重排");
      if (scenario === "random_order") notify("warning", "🟡 新订单已插入，系统正在重新计算排程");
      if (scenario === "composite") notify("error", "⚡ 复合异常已触发，AI已切换审查链路");
    } catch {
      notify("error", "场景触发失败，请检查后端服务");
    } finally {
      setLoadingAction(null);
    }
  }

  async function resetSystem() {
    setLoadingAction("reset");
    try {
      const nextState = await postJson("/api/demo/reset");
      setState(nextState);
      setResult(null);
      setLogs([]);
      notify("success", "⚪ 系统已重置为初始状态");
    } catch {
      notify("error", "重置失败，请检查后端服务");
    } finally {
      setLoadingAction(null);
    }
  }

  async function runDataset(dataset: PublicDataset) {
    setRunningDataset(dataset.id);
    try {
      const data = await postJson(`/api/datasets/public/${dataset.id}/run`);
      applyResult(data);
      await refreshLatestState().catch(() => null);
      const nextMakespan = planMakespan(data.best_plan?.items ?? [], data.best_plan?.metrics);
      setBenchRows((previous) => [
        ...previous.filter((row) => row.id !== dataset.id),
        {
          id: dataset.id,
          datasetName: dataset.name,
          makespan: nextMakespan,
          topology: topologyLabel[data.selected_topology] ?? data.selected_topology ?? "动态拓扑",
          solveTimeMs: Number(data.metrics?.solve_time_ms ?? 0),
          bestKnown: dataset.best_known_makespan ?? dataset.optimal,
        },
      ]);
      notify("success", `${dataset.name} 求解完成，Makespan=${nextMakespan}`);
    } catch {
      notify("error", `${dataset.name} 运行失败`);
    } finally {
      setRunningDataset(null);
    }
  }

  async function runA2C() {
    setLoadingAction("a2c");
    try {
      const data = await postJson("/api/experiments/run_a2c");
      setExperiment(data);
      notify("success", "A2C训练完成，拓扑偏好已更新");
    } catch {
      notify("error", "A2C训练失败，请检查后端服务");
    } finally {
      setLoadingAction(null);
    }
  }

  const factory3DOption = useMemo(() => buildFactory3DOption(machines), [machines]);
  const ganttOption = useMemo(() => buildGanttOption(scheduleItems, makespan), [scheduleItems, makespan]);
  const benchmarkOption = useMemo(() => buildBenchmarkOption(benchRows), [benchRows]);
  const alertBoardConfig = useMemo(
    () => ({
      header: ["时间", "设备", "告警内容"],
      data:
        state?.alerts?.length
          ? state.alerts.map((alert) => [
              formatMinute(Number(alert.minute ?? state.now_minute ?? 0)),
              alert.machine_id ?? "-",
              sanitize(alert.message),
            ])
          : [["--:--", "ALL", "系统运行正常"]],
      rowNum: 5,
      headerHeight: 34,
      columnWidth: [72, 72, 260],
      align: ["center", "center", "left"],
      headerBGC: "rgba(0, 212, 255, 0.16)",
      oddRowBGC: "rgba(4, 32, 62, 0.45)",
      evenRowBGC: "rgba(1, 20, 42, 0.7)",
      hoverPause: true,
    }),
    [state]
  );
  const orderBoardConfig = useMemo(
    () => ({
      header: ["订单ID", "优先级", "截止", "工序"],
      data: allOrders.map((order) => [
        order.id,
        priorityLabel[order.priority] ?? order.priority,
        `${order.due_minute}分`,
        String(order.operations.length),
      ]),
      rowNum: 7,
      headerHeight: 34,
      columnWidth: [90, 80, 82, 58],
      align: ["center", "center", "center", "center"],
      headerBGC: "rgba(0, 212, 255, 0.16)",
      oddRowBGC: "rgba(4, 32, 62, 0.45)",
      evenRowBGC: "rgba(1, 20, 42, 0.7)",
      hoverPause: true,
    }),
    [allOrders]
  );

  const a2cReward =
    experiment?.history?.length ? Number(experiment.history[experiment.history.length - 1]?.reward ?? 0).toFixed(2) : "未训练";

  return (
    <div className="screen-viewport">
      <div className="big-screen" style={{ zoom: scale }}>
        <div className="screen-glow" />
        <header className="screen-header">
          <div className="header-left">
            <span>OEE</span>
            <b style={{ color: oeeColor(oee.oee) }}>{oee.oee}%</b>
            <span className="auto-toggle" onClick={() => setAutoRunning((previous) => !previous)} style={{ cursor: "pointer" }}>
              <i className={autoRunning ? "auto-dot on" : "auto-dot"} />
              <em>{autoRunning ? "自动运行中" : "自动暂停"}</em>
            </span>
          </div>
          <Decoration5 className="header-decoration left" />
          <h1>DynaTwin-Swarm · 工业数字孪生智能排产系统</h1>
          <Decoration5 className="header-decoration right" />
          <div className="header-right">
            <span className="clock">{clock}</span>
            <span className="risk-badge" style={{ borderColor: riskColor(risk), color: riskColor(risk) }}>
              {riskLabel[risk] ?? risk}
            </span>
          </div>
          <div className="header-line" />
        </header>

        <main className="screen-body">
          <section className="screen-column left-column">
            <BorderBox8 className="panel">
              <PanelTitle title="生产指标" />
              <div className="production-metrics">
                <DigitalMetric label="OEE综合效率" value={oee.oee} suffix="%" color={oeeColor(oee.oee)} />
                <DigitalMetric label="在制订单数" value={allOrders.length} color="#00D4FF" />
                <DigitalMetric label="完工预估分钟" value={makespan} color="#E8F4FF" />
              </div>
            </BorderBox8>

            <BorderBox12 className="panel">
              <PanelTitle title="设备状态" />
              <div className="machine-list">
                {machines.map((machine) => (
                  <MachineRow
                    key={machine.id}
                    machine={machine}
                    nowMinute={state?.now_minute ?? 0}
                    recoveryMinute={recoverySchedule[machine.id]}
                  />
                ))}
                {!machines.length && <div className="empty-text">暂无设备数据</div>}
              </div>
              <div className="machine-summary">
                {normalMachineCount}/{machines.length || 0}台正常运行
              </div>
            </BorderBox12>

            <BorderBox13 className="panel">
              <PanelTitle title="活跃告警" />
              <div className="scroll-board-wrap">
                <ScrollBoard config={alertBoardConfig} />
              </div>
            </BorderBox13>
          </section>

          <section className="screen-column center-column">
            <div className="kpi-strip">
              <KpiBox title="当前拓扑" value={topologyLabel[topology] ?? topology} color="#00D4FF" />
              <KpiBox title="风险等级" value={riskLabel[risk] ?? risk} color={riskColor(risk)} />
              <KpiBox title="在制订单" value={String(allOrders.length)} color="#E8F4FF" />
              <KpiBox title="完工时间" value={`${makespan || 0} 分`} color="#00FF88" />
            </div>

            <BorderBox8 className="panel factory-panel">
              <div className="visual-title">
                <span>3D工厂布局 · 工厂实时状态</span>
                <Decoration6 className="visual-decoration" />
              </div>
              <ReactECharts option={factory3DOption} className="factory-chart" notMerge lazyUpdate />
            </BorderBox8>

            <BorderBox12 className="panel gantt-panel">
              <div className="visual-title compact">
                <span>排程甘特图</span>
                <Decoration3 className="visual-decoration-small" />
              </div>
              <ReactECharts option={ganttOption} className="gantt-chart" notMerge lazyUpdate />
            </BorderBox12>
          </section>

          <section className="screen-column right-column">
            <BorderBox8 className="panel ai-panel">
              <PanelTitle title="AI决策过程" />
              <div className="topology-card">
                <span>协作拓扑</span>
                <strong>{topologyLabel[topology] ?? topology}</strong>
                <p>{sanitize(result?.topology_selection?.reason ?? "等待下一次调度决策")}</p>
              </div>
              <div className="log-stream">
                {logs.slice(-20).map((log, index) => (
                  <div key={log.id} className="log-line">
                    <span className="log-time">[{log.ts}]</span>
                    <b style={{ color: AGENT_COLORS[index % AGENT_COLORS.length] }}>[{log.agent}]</b>
                    <em>{log.action}</em>
                  </div>
                ))}
                {!logs.length && <div className="empty-text">等待Agent推理日志</div>}
              </div>
            </BorderBox8>

            <BorderBox12 className="panel order-panel">
              <PanelTitle title={`订单队列 · ${allOrders.length}`} />
              <div className="scroll-board-wrap order-board">
                <ScrollBoard config={orderBoardConfig} />
              </div>
              <div className="order-tags">
                <span className="urgent">紧急 {allOrders.filter((order) => order.priority === "urgent").length}</span>
                <span className="high">高优先 {allOrders.filter((order) => order.priority === "high").length}</span>
                <span>普通 {allOrders.filter((order) => order.priority === "normal").length}</span>
              </div>
            </BorderBox12>

            <BorderBox13 className="panel benchmark-panel">
              <PanelTitle title="基准测试" />
              <ReactECharts option={benchmarkOption} className="benchmark-chart" notMerge lazyUpdate />
              <div className="dataset-buttons">
                {datasets.slice(0, 5).map((dataset) => (
                  <button key={dataset.id} disabled={Boolean(runningDataset)} onClick={() => runDataset(dataset)}>
                    {runningDataset === dataset.id ? "求解中" : dataset.name.replace("JSPLib ", "")}
                  </button>
                ))}
                {!datasets.length && <span className="empty-text">暂无数据集</span>}
              </div>
            </BorderBox13>
          </section>
        </main>

        <footer className="operation-bar">
          <div className="service-status">
            {Object.entries(integrations).slice(0, 8).map(([name, value]) => (
              <span key={name}>
                <i className={serviceConnected(value) ? "service-dot on" : "service-dot"} />
                {serviceLabel[name] ?? name}
              </span>
            ))}
            {!Object.keys(integrations).length && <span>服务状态加载中</span>}
          </div>
          <div className="scenario-buttons">
            <DvButton tone="red" loading={loadingAction === "random_failure"} onClick={() => triggerScenario("random_failure")}>
              🔴触发设备故障
            </DvButton>
            <DvButton tone="yellow" loading={loadingAction === "random_order"} onClick={() => triggerScenario("random_order")}>
              🟡插入紧急订单
            </DvButton>
            <DvButton tone="blue" loading={loadingAction === "composite"} onClick={() => triggerScenario("composite")}>
              ⚡复合异常演示
            </DvButton>
            <DvButton tone="gray" loading={loadingAction === "reset"} onClick={resetSystem}>
              ⚪重置系统
            </DvButton>
          </div>
          <div className="training-box">
            <button onClick={runA2C} disabled={loadingAction === "a2c"}>{loadingAction === "a2c" ? "训练中" : "A2C训练"}</button>
            <span>Reward {a2cReward}</span>
          </div>
        </footer>
      </div>
      <NoticeStack notices={notices} onClose={(id) => setNotices((previous) => previous.filter((notice) => notice.id !== id))} />
    </div>
  );
}

function KpiBox({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <BorderBox11 className="kpi-box" title={title} titleWidth={120}>
      <div className="kpi-box-value" style={{ color }}>
        {value}
      </div>
    </BorderBox11>
  );
}

function DvButton({
  tone,
  loading,
  onClick,
  children,
}: {
  tone: "red" | "yellow" | "blue" | "gray";
  loading?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <BorderBox1 className={`dv-button-wrap ${tone}`}>
      <button className="dv-button" onClick={onClick} disabled={loading}>
        {loading ? "执行中..." : children}
      </button>
    </BorderBox1>
  );
}

function buildFactory3DOption(machines: Machine[]) {
  const displayMachines =
    machines.length > 0
      ? machines
      : Array.from({ length: 15 }, (_, index) => ({
          id: `M${index + 1}`,
          name: `Default Machine ${index + 1}`,
          status: "available",
          temperature_c: 25,
          efficiency: 0.95,
          current_order_id: "-",
        }));
  const cols = Math.max(2, Math.ceil(Math.sqrt(displayMachines.length || 1)));
  const rows = Math.max(2, Math.ceil((displayMachines.length || 1) / cols));
  const xData = Array.from({ length: cols }, (_, index) => `X${index + 1}`);
  const yData = Array.from({ length: rows }, (_, index) => `Y${index + 1}`);
  const data = displayMachines.map((machine, index) => [
    index % cols,
    Math.floor(index / cols),
    Math.max(15, Math.round((machine.efficiency ?? 0.9) * 100)),
    machine.id,
    machine.status,
    machine.temperature_c,
    machine.current_order_id ?? "-",
    machine.name,
  ]);
  return {
    backgroundColor: "transparent",
    tooltip: {
      backgroundColor: "rgba(2, 11, 24, 0.92)",
      borderColor: "#00D4FF",
      textStyle: { color: "#E8F4FF" },
      formatter: (params: any) => {
        const value = params.value;
        return `${value[3]} / ${value[7]}<br/>状态：${machineStatusLabel[value[4]] ?? value[4]}<br/>温度：${Math.round(value[5])}°C<br/>当前工单：${value[6]}`;
      },
    },
    xAxis3D: {
      type: "category",
      data: xData,
      axisLine: { lineStyle: { color: "#0D3A6E" } },
      axisLabel: { color: "#5B8DB8" },
    },
    yAxis3D: {
      type: "category",
      data: yData,
      axisLine: { lineStyle: { color: "#0D3A6E" } },
      axisLabel: { color: "#5B8DB8" },
    },
    zAxis3D: {
      type: "value",
      min: 0,
      max: 110,
      axisLine: { lineStyle: { color: "#0D3A6E" } },
      splitLine: { lineStyle: { color: "#0A2540" } },
      axisLabel: { color: "#5B8DB8" },
    },
    grid3D: {
      boxWidth: 210,
      boxDepth: 120,
      boxHeight: 86,
      environment: "#020B18",
      splitLine: { lineStyle: { color: "#0A2540" } },
      viewControl: { alpha: 25, beta: 30, distance: 200, autoRotate: false, rotateSensitivity: 1, zoomSensitivity: 1 },
      light: {
        main: { intensity: 1.8, shadow: true, shadowQuality: "high" },
        ambient: { intensity: 0.55 },
      },
      axisPointer: { show: false },
    },
    series: [
      {
        type: "bar3D",
        data,
        bevelSize: 0.6,
        bevelSmoothness: 3,
        barSize: 14,
        shading: "lambert",
        label: {
          show: true,
          formatter: (params: any) => params.value[3],
          color: "#E8F4FF",
          fontSize: 13,
          fontWeight: "bold",
          fontFamily: "Courier New",
        },
        itemStyle: {
          color: (params: any) => factoryMachineGradient(params.value[4]),
          opacity: 0.92,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 20,
            shadowColor: "#00D4FF",
          },
        },
      },
    ],
  };
}

function buildGanttOption(items: ScheduleItem[], makespan: number) {
  const visible = items.slice(0, 18);
  if (!visible.length) {
    return {
      backgroundColor: "transparent",
      graphic: {
        type: "text",
        left: "center",
        top: "middle",
        style: {
          text: "触发场景演示或运行数据集后显示排程",
          fill: "#5B8DB8",
          fontSize: 18,
          fontWeight: 600,
        },
      },
      xAxis: { type: "value", show: false },
      yAxis: { type: "category", show: false, data: ["等待排程"] },
      series: [],
    };
  }
  const machines = Array.from(new Set(items.map((item) => item.machine_id)));
  const colorMap = new Map(machines.map((machine, index) => [machine, MACHINE_COLORS[index % MACHINE_COLORS.length]]));
  const categories = visible.map((item) => item.operation_id);
  return {
    backgroundColor: "transparent",
    grid: { left: 90, right: 26, top: 18, bottom: 30 },
    tooltip: {
      backgroundColor: "rgba(2, 11, 24, 0.92)",
      borderColor: "#00D4FF",
      textStyle: { color: "#E8F4FF" },
      formatter: (params: any) => {
        const item = visible[params.dataIndex];
        if (!item || params.seriesName === "offset") return "";
        return `${item.operation_id}<br/>机器：${item.machine_id}<br/>开始：${item.start_minute} 分钟<br/>结束：${item.end_minute} 分钟<br/>时长：${item.end_minute - item.start_minute} 分钟`;
      },
    },
    xAxis: {
      type: "value",
      min: 0,
      max: Math.max(makespan, 120),
      axisLine: { lineStyle: { color: "#0D3A6E" } },
      splitLine: { lineStyle: { color: "#0A2540" } },
      axisLabel: { color: "#5B8DB8", fontFamily: "Courier New" },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: categories,
      axisLine: { lineStyle: { color: "#0D3A6E" } },
      axisLabel: { color: "#E8F4FF", fontSize: 10 },
    },
    series: [
      {
        name: "duration",
        type: "custom",
        data: visible.map((item, index) => [
          item.start_minute,
          Math.max(1, item.end_minute - item.start_minute),
          index,
          item.machine_id,
          item.operation_id,
        ]),
        renderItem: (params: any, api: any) => {
          const start = Number(api.value(0));
          const duration = Number(api.value(1));
          const categoryIndex = Number(api.value(2));
          const machineId = String(api.value(3));
          const startPoint = api.coord([start, categoryIndex]);
          const endPoint = api.coord([start + duration, categoryIndex]);
          const height = 14;
          const base = colorMap.get(machineId) ?? "#00D4FF";
          const shape = echarts.graphic.clipRectByRect(
            {
              x: startPoint[0],
              y: startPoint[1] - height / 2,
              width: Math.max(2, endPoint[0] - startPoint[0]),
              height,
            },
            {
              x: params.coordSys.x,
              y: params.coordSys.y,
              width: params.coordSys.width,
              height: params.coordSys.height,
            }
          );
          if (!shape) return null;
          return {
            type: "rect",
            shape,
            style: {
              fill: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: "#053A68" },
                { offset: 1, color: base },
              ]),
              shadowBlur: 6,
              shadowColor: base,
            },
          };
        },
      },
    ],
  };
}

function buildBenchmarkOption(rows: BenchmarkRow[]) {
  const data = rows.length ? rows : [{ datasetName: "等待运行", makespan: 0 }];
  return {
    backgroundColor: "transparent",
    grid: { left: 45, right: 18, top: 20, bottom: 34 },
    tooltip: {
      backgroundColor: "rgba(2, 11, 24, 0.92)",
      borderColor: "#00D4FF",
      textStyle: { color: "#E8F4FF" },
    },
    xAxis: {
      type: "category",
      data: data.map((row) => row.datasetName),
      axisLine: { lineStyle: { color: "#0D3A6E" } },
      axisLabel: { color: "#5B8DB8", rotate: 20, fontSize: 10 },
    },
    yAxis: {
      type: "value",
      axisLine: { lineStyle: { color: "#0D3A6E" } },
      splitLine: { lineStyle: { color: "#0A2540" } },
      axisLabel: { color: "#5B8DB8", fontFamily: "Courier New" },
    },
    series: [
      {
        type: "bar",
        data: data.map((row) => row.makespan),
        barWidth: 22,
        itemStyle: {
          borderRadius: [8, 8, 0, 0],
          shadowBlur: 12,
          shadowColor: "#00D4FF",
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#00D4FF" },
            { offset: 1, color: "#005D89" },
          ]),
        },
      },
    ],
  };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
