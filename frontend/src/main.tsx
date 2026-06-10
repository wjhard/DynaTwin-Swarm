import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import ReactFlow, { Background, Controls, Edge, Node } from "reactflow";
import "reactflow/dist/style.css";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Boxes,
  BrainCircuit,
  Clock,
  Database,
  Factory,
  GitBranch,
  Gauge,
  Layers,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Workflow,
  Zap,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import "./styles.css";

type Machine = {
  id: string;
  name: string;
  machine_type: string;
  capabilities?: string[];
  status: string;
  efficiency: number;
  current_order_id?: string | null;
  temperature_c: number;
};

type Order = {
  id: string;
  priority: string;
  due_minute: number;
  operations: { id: string; required_capability: string; duration_minutes: number }[];
};

type Material = { id: string; name: string; quantity: number; reserved: number; unit: string };
type Alert = { id: string; machine_id: string; alert_type: string; severity: string; message: string; minute: number; requires_stop: boolean };
type Trace = { agent_name: string; provider: string; decision: { risk_level: string; recommended_action: string; evidence: string[]; confidence: number; gap: string } };
type ScheduleItem = { order_id: string; operation_id: string; machine_id: string; start_minute: number; end_minute: number; status: string };
type IntegrationStatus = Record<string, string>;
type FactoryState = {
  now_minute: number;
  machines: Machine[];
  orders: Order[];
  materials: Material[];
  alerts: Alert[];
  events: Record<string, unknown>[];
  metadata: Record<string, unknown>;
};

type RunResult = {
  task_id: string;
  task_profile: Record<string, unknown>;
  selected_topology: string;
  topology_selection: { topology_name: string; reason: string; confidence: number };
  agent_traces: Trace[];
  best_plan: { items: ScheduleItem[]; violations: { constraint: string; severity: string; message: string }[]; metrics: Record<string, unknown> };
  alternative_plans: { items: ScheduleItem[]; objective: string }[];
  risk_summary: Record<string, unknown>;
  metrics: Record<string, unknown>;
};

type PublicDataset = {
  id: string;
  name: string;
  family: string;
  source: string;
  source_url: string;
  description: string;
  machine_count: number;
  job_count: number;
  operation_count: number;
  best_known_makespan?: number;
};

const API_BASE = (import.meta.env.VITE_API_BASE || "http://127.0.0.1:8010").replace(/\/$/, "");

const fallbackIntegrationStatus: IntegrationStatus = {
  PanguLM: "mock",
  MindIE: "mock",
  GaussDB: "sqlite fallback",
  OBS: "local fallback",
  IoTDA: "local event bus",
  EventGrid: "local router",
  FunctionGraph: "local trigger",
  ModelArts: "local training",
};

const fallbackMachines: Machine[] = [
  { id: "M1", name: "Cutter 1", machine_type: "cutting", status: "busy", efficiency: 1, temperature_c: 25 },
  { id: "M2", name: "Cutter 2", machine_type: "cutting", status: "available", efficiency: 1, temperature_c: 25 },
  { id: "M3", name: "Precision Mill 1", machine_type: "precision", status: "failed", efficiency: 1, temperature_c: 96 },
  { id: "M4", name: "Precision Mill 2", machine_type: "precision", status: "available", efficiency: 0.72, temperature_c: 25 },
];

const fallbackOrders: Order[] = [
  { id: "O1", priority: "normal", due_minute: 600, operations: [] },
  { id: "O2", priority: "high", due_minute: 480, operations: [] },
  { id: "O4", priority: "urgent", due_minute: 450, operations: [] },
];

const fallbackMaterials: Material[] = [
  { id: "steel", name: "Steel Blank", quantity: 5, reserved: 0, unit: "pcs" },
  { id: "coolant", name: "Coolant", quantity: 4, reserved: 0, unit: "pcs" },
];

const topologyEdges: Record<string, [string, string][]> = {
  serial_chain: [["TaskRouter", "Monitor"], ["Monitor", "Schedule"], ["Schedule", "Constraint"], ["Constraint", "Report"]],
  parallel_fusion: [["TaskRouter", "Monitor"], ["Monitor", "Diagnosis"], ["Monitor", "Order"], ["Monitor", "Resource"], ["Diagnosis", "Schedule"], ["Order", "Schedule"], ["Resource", "Schedule"], ["Schedule", "Constraint"], ["Constraint", "Report"]],
  supervisor_tree: [["TaskRouter", "Supervisor"], ["Supervisor", "Diagnosis"], ["Supervisor", "Order"], ["Supervisor", "Resource"], ["Supervisor", "Risk"], ["Diagnosis", "Schedule"], ["Order", "Schedule"], ["Resource", "Schedule"], ["Risk", "Schedule"], ["Schedule", "Constraint"], ["Constraint", "Critic"], ["Critic", "Report"]],
  high_risk_review: [["TaskRouter", "Monitor"], ["Monitor", "Diagnosis"], ["Monitor", "Order"], ["Monitor", "Resource"], ["Diagnosis", "Schedule"], ["Order", "Schedule"], ["Resource", "Schedule"], ["Schedule", "Constraint"], ["Constraint", "Risk"], ["Risk", "Critic"], ["Critic", "FinalDecision"], ["FinalDecision", "Report"]],
};

const topologyLabel: Record<string, string> = {
  serial_chain: "串行调度链",
  parallel_fusion: "并行资源融合",
  supervisor_tree: "监督汇总树",
  high_risk_review: "高风险复核链",
};

const nodeLabel: Record<string, string> = {
  TaskRouter: "任务路由",
  Supervisor: "监督器",
  Monitor: "状态监控",
  Diagnosis: "故障诊断",
  Order: "订单分析",
  Resource: "资源分析",
  Schedule: "调度求解",
  Constraint: "约束校验",
  Risk: "风险评估",
  Critic: "批判复核",
  FinalDecision: "最终决策",
  Report: "报告输出",
};

const riskLabel: Record<string, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
  critical: "严重风险",
};

const machineStatusLabel: Record<string, string> = {
  available: "可用",
  busy: "运行中",
  failed: "故障",
  maintenance: "维护中",
};

const priorityLabel: Record<string, string> = {
  normal: "普通",
  high: "高优先级",
  urgent: "紧急",
};

async function postJson(path: string, body: unknown) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path} failed: ${response.status}`);
  return response.json();
}

async function getJson(path: string) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`${path} failed: ${response.status}`);
  return response.json();
}

function minuteLabel(minute: number) {
  const total = 8 * 60 + minute;
  const h = Math.floor(total / 60).toString().padStart(2, "0");
  const m = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function buildFlow(topology: string): { nodes: Node[]; edges: Edge[] } {
  const edges = topologyEdges[topology] ?? topologyEdges.high_risk_review;
  const names = Array.from(new Set(edges.flat()));
  const nodes = names.map((name, index) => ({
    id: name,
    data: { label: nodeLabel[name] ?? name },
    position: { x: (index % 4) * 210, y: Math.floor(index / 4) * 96 },
    className: name.includes("Risk") || name.includes("Critic") ? "risk-node" : "flow-node",
  }));
  return {
    nodes,
    edges: edges.map(([source, target]) => ({ id: `${source}-${target}`, source, target, animated: topology === "high_risk_review" })),
  };
}

function planMakespan(result: RunResult | null) {
  return Math.max(0, ...(result?.best_plan.items ?? []).map((item) => item.end_minute));
}

function App() {
  const [result, setResult] = useState<RunResult | null>(null);
  const [previousResult, setPreviousResult] = useState<RunResult | null>(null);
  const [factoryState, setFactoryState] = useState<FactoryState | null>(null);
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus>(fallbackIntegrationStatus);
  const [publicDatasets, setPublicDatasets] = useState<PublicDataset[]>([]);
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const [runLog, setRunLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const machines = factoryState?.machines?.length ? factoryState.machines : fallbackMachines;
  const orders = factoryState?.orders?.length ? factoryState.orders : fallbackOrders;
  const materials = factoryState?.materials?.length ? factoryState.materials : fallbackMaterials;
  const displayEvents = events.length ? events : factoryState?.events ?? [];
  const alertCount = factoryState?.alerts?.length ?? 0;
  const operationCount = orders.reduce((count, order) => count + order.operations.length, 0);
  const latestScenario = String(factoryState?.metadata?.scenario ?? "未加载");
  const datasetName = String(factoryState?.metadata?.dataset_name ?? "");
  const topology = result?.selected_topology ?? "high_risk_review";
  const risk = String(result?.task_profile?.risk_level ?? "critical");
  const flow = useMemo(() => buildFlow(topology), [topology]);
  const chartData = result?.best_plan.items.map((item) => ({
    name: item.operation_id.replace("JSPLIB_FT06-", ""),
    duration: item.end_minute - item.start_minute,
  })) ?? [];
  const statusItems = [`API: ${API_BASE}`, ...Object.entries(integrationStatus).map(([name, status]) => `${name}: ${status}`)];
  const currentMakespan = planMakespan(result);
  const previousMakespan = planMakespan(previousResult);
  const benchmark = typeof factoryState?.metadata?.best_known_makespan === "number" ? Number(factoryState.metadata.best_known_makespan) : undefined;

  useEffect(() => {
    void bootDemo();
  }, []);

  function appendLog(message: string) {
    const time = new Date().toLocaleTimeString();
    setRunLog((previous) => [`${time} ${message}`, ...previous].slice(0, 8));
  }

  async function bootDemo() {
    try {
      await Promise.all([refreshState(), refreshDatasets()]);
    } finally {
      await runScenario("main");
    }
  }

  async function refreshDatasets() {
    const payload = await getJson("/api/datasets/public");
    setPublicDatasets(Array.isArray(payload?.datasets) ? payload.datasets : []);
  }

  async function refreshState() {
    const [statePayload, eventsPayload, statusPayload] = await Promise.all([
      getJson("/api/state"),
      getJson("/api/events/latest"),
      getJson("/api/integrations/status"),
    ]);
    if (Array.isArray(statePayload?.machines)) {
      setFactoryState(statePayload as FactoryState);
    }
    if (statusPayload?.status) {
      setIntegrationStatus(statusPayload.status as IntegrationStatus);
    }
    if (Array.isArray(eventsPayload?.events)) {
      setEvents(eventsPayload.events);
    } else if (Array.isArray(statePayload?.events)) {
      setEvents(statePayload.events);
    }
  }

  async function runScenario(scenario: string) {
    setBusy(true);
    setError("");
    try {
      const payload = await postJson("/api/tasks/run", { scenario });
      setPreviousResult(result);
      setResult(payload);
      await refreshState();
      appendLog(`场景 ${scenario} -> ${payload.selected_topology}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "请求失败";
      setError(message);
      appendLog(message);
    } finally {
      setBusy(false);
    }
  }

  async function runPublicDataset(datasetId: string) {
    setBusy(true);
    setError("");
    try {
      const payload = await postJson(`/api/datasets/public/${datasetId}/run`, {});
      setPreviousResult(result);
      setResult(payload);
      await refreshState();
      appendLog(`公开数据集 ${datasetId} -> ${payload.selected_topology}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "公开数据集运行失败";
      setError(message);
      appendLog(message);
    } finally {
      setBusy(false);
    }
  }

  async function triggerMachineAlert() {
    setBusy(true);
    setError("");
    try {
      await postJson("/api/events/machine-alert", { machine_id: "M3" });
      await refreshState();
      appendLog("事件 M3 设备过热");
    } catch (err) {
      const message = err instanceof Error ? err.message : "请求失败";
      setError(message);
      appendLog(message);
      setBusy(false);
      return;
    }
    setBusy(false);
    await runScenario("single_machine_failure");
  }

  async function createUrgentOrder() {
    setBusy(true);
    setError("");
    try {
      await postJson("/api/events/order-created", { order_id: "O4" });
      await refreshState();
      appendLog("事件 新增紧急订单 O4");
    } catch (err) {
      const message = err instanceof Error ? err.message : "请求失败";
      setError(message);
      appendLog(message);
      setBusy(false);
      return;
    }
    setBusy(false);
    await runScenario("multi_resource_conflict");
  }

  async function resetDemo() {
    setBusy(true);
    setError("");
    try {
      await postJson("/api/demo/reset", {});
      setPreviousResult(result);
      setResult(null);
      await refreshState();
      appendLog("演示已重置");
    } catch (err) {
      const message = err instanceof Error ? err.message : "请求失败";
      setError(message);
      appendLog(message);
      setBusy(false);
      return;
    }
    setBusy(false);
    await runScenario("normal");
  }

  const decisionTitle = risk === "critical"
    ? "发现严重风险，系统已切换到高风险复核链"
    : risk === "high"
      ? "存在高风险约束，系统进入强化校验"
      : "当前生产状态可执行，系统采用轻量调度链";
  const decisionText = datasetName
    ? `当前正在使用公开基准数据集 ${datasetName}，包含 ${orders.length} 个作业、${machines.length} 台机器、${operationCount} 道工序。`
    : result?.topology_selection?.reason ?? "等待系统运行后生成决策摘要。";

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark"><Factory size={22} />DynaTwin</div>
        <nav>
          <a href="#overview"><Gauge size={17} />总览</a>
          <a href="#datasets"><Database size={17} />数据集</a>
          <a href="#agents"><BrainCircuit size={17} />智能体</a>
          <a href="#schedule"><Clock size={17} />排程</a>
          <a href="#events"><Activity size={17} />事件</a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">工业数字孪生多智能体调度平台</p>
            <h1>DynaTwin-Swarm 智能排产系统</h1>
            <p>公开数据集验证、动态 Agent 拓扑、ReflAct 决策链与 CP-SAT 调度求解</p>
          </div>
          <div className="status-strip">
            {statusItems.map((item) => <span key={item}>{item}</span>)}
          </div>
        </header>

        <section className="toolbar">
          <button onClick={() => runScenario("normal")} disabled={busy} title="运行正常排产"><Play size={17} />正常排产</button>
          <button onClick={triggerMachineAlert} disabled={busy} title="触发 M3 过热"><Thermometer size={17} />M3 过热</button>
          <button onClick={createUrgentOrder} disabled={busy} title="新增紧急订单 O4"><Plus size={17} />新增紧急订单</button>
          <button onClick={() => runScenario("main")} disabled={busy} title="运行组合异常演示"><Zap size={17} />组合异常演示</button>
          <button onClick={() => runPublicDataset("jsplib_ft06")} disabled={busy} title="运行 JSPLib FT06 公开数据集"><Database size={17} />运行 FT06 数据集</button>
          <button onClick={resetDemo} disabled={busy} title="重置演示"><RotateCcw size={17} />重置</button>
        </section>

        {error && <div className="error">{error}</div>}

        <section className="summary-band" id="overview">
          <div className={`decision-card ${risk}`}>
            <div className="decision-icon"><ShieldCheck size={24} /></div>
            <div>
              <span>当前决策摘要</span>
              <h2>{decisionTitle}</h2>
              <p>{decisionText}</p>
            </div>
          </div>
          <Metric label="运行状态" value={busy ? "运行中" : "就绪"} />
          <Metric label="当前场景" value={datasetName || latestScenario} />
          <Metric label="风险等级" value={riskLabel[risk] ?? risk} tone={risk} />
          <Metric label="已排工序" value={`${result?.best_plan.items.length ?? 0}/${operationCount}`} />
          <Metric label="当前拓扑" value={topologyLabel[topology] ?? topology} />
        </section>

        <section className="grid overview-grid">
          <Panel title="设备状态" icon={<Factory size={18} />}>
            <div className="machine-grid">
              {machines.map((machine) => (
                <div className={`machine ${machine.status}`} key={machine.id}>
                  <strong>{machine.id}</strong>
                  <span>{machine.name}</span>
                  <small>{machineStatusLabel[machine.status] ?? machine.status} - {Math.round(machine.temperature_c)}C</small>
                  <small>{machine.current_order_id ? `工单 ${machine.current_order_id}` : machine.capabilities?.join(", ")}</small>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="订单队列" icon={<Clock size={18} />}>
            <table>
              <tbody>
                {orders.slice(0, 8).map((order) => (
                  <tr key={order.id}>
                    <td>{order.id}</td>
                    <td><span className={`pill ${order.priority}`}>{priorityLabel[order.priority] ?? order.priority}</span></td>
                    <td>{minuteLabel(order.due_minute)}</td>
                    <td>{order.operations.length} 道</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Panel title="物料库存" icon={<Boxes size={18} />}>
            {materials.map((material) => (
              <div className="material" key={material.id}>
                <span>{material.name}</span>
                <strong>{material.quantity - material.reserved}/{material.quantity} {material.unit}</strong>
              </div>
            ))}
          </Panel>
          <Panel title="调度对比" icon={<BarChart3 size={18} />}>
            <div className="comparison">
              <div><span>上次完工时间</span><strong>{previousMakespan ? `${previousMakespan}` : "无"}</strong></div>
              <div><span>当前完工时间</span><strong>{currentMakespan ? `${currentMakespan}` : "待运行"}</strong></div>
              <div><span>公开最优参考</span><strong>{benchmark ? `${benchmark}` : "非公开集"}</strong></div>
              <p>{previousMakespan && currentMakespan ? `变化：${currentMakespan - previousMakespan >= 0 ? "+" : ""}${currentMakespan - previousMakespan}` : "运行不同场景后可查看前后排程变化。"}</p>
            </div>
          </Panel>
        </section>

        <section className="dataset-section" id="datasets">
          <div className="section-heading">
            <span><Database size={18} />公开数据集中心</span>
            <p>当前接入真实公开 Job Shop benchmark，先用 FT06 支撑调度算法验证。</p>
          </div>
          <div className="dataset-grid">
            {publicDatasets.map((dataset) => (
              <article className="dataset-card" key={dataset.id}>
                <div>
                  <span className="dataset-family">{dataset.family}</span>
                  <h3>{dataset.name}</h3>
                  <p>{dataset.description}</p>
                </div>
                <dl>
                  <div><dt>作业</dt><dd>{dataset.job_count}</dd></div>
                  <div><dt>机器</dt><dd>{dataset.machine_count}</dd></div>
                  <div><dt>工序</dt><dd>{dataset.operation_count}</dd></div>
                  <div><dt>最优参考</dt><dd>{dataset.best_known_makespan ?? "-"}</dd></div>
                </dl>
                <p className="source-line">来源：{dataset.source}</p>
                <button onClick={() => runPublicDataset(dataset.id)} disabled={busy}><Play size={16} />运行该数据集</button>
              </article>
            ))}
          </div>
        </section>

        <section className="split" id="agents">
          <Panel title="动态智能体拓扑" icon={<GitBranch size={18} />}>
            <div className="flow-wrap">
              <ReactFlow nodes={flow.nodes} edges={flow.edges} fitView nodesDraggable={false} nodesConnectable={false}>
                <Background />
                <Controls showInteractive={false} />
              </ReactFlow>
            </div>
          </Panel>
          <Panel title="ReflAct 智能体决策链" icon={<BrainCircuit size={18} />}>
            <div className="trace-list">
              {(result?.agent_traces ?? []).slice(0, 10).map((trace) => (
                <div className="trace" key={trace.agent_name}>
                  <div><strong>{trace.agent_name}</strong><span>{riskLabel[trace.decision.risk_level] ?? trace.decision.risk_level} - {Math.round(trace.decision.confidence * 100)}%</span></div>
                  <p>{trace.decision.recommended_action}</p>
                  {trace.decision.evidence?.[0] && <small className="provider-note">{trace.provider}: {trace.decision.evidence[0]}</small>}
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="split lower" id="schedule">
          <Panel title="生产排程甘特图" icon={<Workflow size={18} />}>
            <div className="gantt">
              {(result?.best_plan.items ?? []).slice(0, 36).map((item) => (
                <div className="gantt-row" key={item.operation_id}>
                  <span>{item.operation_id.replace("JSPLIB_FT06-", "")}</span>
                  <div><b style={{ left: `${Math.min(90, item.start_minute / Math.max(1, currentMakespan || 1) * 80)}%`, width: `${Math.max(6, (item.end_minute - item.start_minute) / Math.max(1, currentMakespan || 1) * 80)}%` }}>{item.machine_id} {minuteLabel(item.start_minute)}-{minuteLabel(item.end_minute)}</b></div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="工序耗时指标" icon={<BarChart3 size={18} />}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData.slice(0, 18)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="duration" fill="#287c76" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </section>

        <section className="grid detail" id="events">
          <Panel title="备选方案" icon={<Layers size={18} />}>
            {(result?.alternative_plans ?? []).map((plan, index) => <p key={index}>{plan.objective}: {plan.items.length} 道工序</p>)}
          </Panel>
          <Panel title="事件流" icon={<Activity size={18} />}>
            <div className="events">{displayEvents.map((event, index) => <code key={index}>{JSON.stringify(event)}</code>)}</div>
          </Panel>
          <Panel title="运行历史" icon={<Sparkles size={18} />}>
            <p>{result?.task_id ?? "暂无任务"}</p>
            <p>{topologyLabel[result?.selected_topology ?? ""] ?? "等待运行"}</p>
            <div className="events">{runLog.map((entry) => <code key={entry}>{entry}</code>)}</div>
          </Panel>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`metric ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel">
      <h2>{icon}{title}</h2>
      {children}
    </section>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
