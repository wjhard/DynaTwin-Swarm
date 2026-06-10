import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import ReactFlow, { Background, Controls, Edge, Node } from "reactflow";
import "reactflow/dist/style.css";
import { Activity, AlertTriangle, Boxes, Clock, Factory, GitBranch, Play, Plus, RotateCcw, Thermometer, Zap } from "lucide-react";
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
type Trace = { agent_name: string; decision: { risk_level: string; recommended_action: string; evidence: string[]; confidence: number; gap: string } };
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

const API_BASE = (import.meta.env.VITE_API_BASE || "http://127.0.0.1:8010").replace(/\/$/, "");

const fallbackIntegrationStatus: IntegrationStatus = {
  PanguLM: "mock",
  MindIE: "mock",
  GaussDB: "sqlite fallback",
  OBS: "local fallback",
  IoTDA: "local event bus",
  EventGrid: "local router",
  FunctionGraph: "local trigger",
  ModelArts: "local training"
};

const fallbackMachines: Machine[] = [
  { id: "M1", name: "Cutter 1", machine_type: "cutting", status: "busy", efficiency: 1, temperature_c: 25 },
  { id: "M2", name: "Cutter 2", machine_type: "cutting", status: "available", efficiency: 1, temperature_c: 25 },
  { id: "M3", name: "Precision Mill 1", machine_type: "precision", status: "failed", efficiency: 1, temperature_c: 96 },
  { id: "M4", name: "Precision Mill 2", machine_type: "precision", status: "available", efficiency: 0.72, temperature_c: 25 }
];

const fallbackOrders: Order[] = [
  { id: "O1", priority: "normal", due_minute: 600, operations: [] },
  { id: "O2", priority: "high", due_minute: 480, operations: [] },
  { id: "O4", priority: "urgent", due_minute: 450, operations: [] }
];

const fallbackMaterials: Material[] = [
  { id: "steel", name: "Steel Blank", quantity: 5, reserved: 0, unit: "pcs" },
  { id: "coolant", name: "Coolant", quantity: 4, reserved: 0, unit: "pcs" }
];

const topologyEdges: Record<string, [string, string][]> = {
  serial_chain: [["TaskRouter", "Monitor"], ["Monitor", "Schedule"], ["Schedule", "Constraint"], ["Constraint", "Report"]],
  parallel_fusion: [["TaskRouter", "Monitor"], ["Monitor", "Diagnosis"], ["Monitor", "Order"], ["Monitor", "Resource"], ["Diagnosis", "Schedule"], ["Order", "Schedule"], ["Resource", "Schedule"], ["Schedule", "Constraint"], ["Constraint", "Report"]],
  supervisor_tree: [["TaskRouter", "Supervisor"], ["Supervisor", "Diagnosis"], ["Supervisor", "Order"], ["Supervisor", "Resource"], ["Supervisor", "Risk"], ["Diagnosis", "Schedule"], ["Order", "Schedule"], ["Resource", "Schedule"], ["Risk", "Schedule"], ["Schedule", "Constraint"], ["Constraint", "Critic"], ["Critic", "Report"]],
  high_risk_review: [["TaskRouter", "Monitor"], ["Monitor", "Diagnosis"], ["Monitor", "Order"], ["Monitor", "Resource"], ["Diagnosis", "Schedule"], ["Order", "Schedule"], ["Resource", "Schedule"], ["Schedule", "Constraint"], ["Constraint", "Risk"], ["Risk", "Critic"], ["Critic", "FinalDecision"], ["FinalDecision", "Report"]]
};

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
    data: { label: name },
    position: { x: (index % 4) * 190, y: Math.floor(index / 4) * 92 },
    className: name.includes("Risk") || name.includes("Critic") ? "risk-node" : "flow-node"
  }));
  return {
    nodes,
    edges: edges.map(([source, target]) => ({ id: `${source}-${target}`, source, target, animated: topology === "high_risk_review" }))
  };
}

async function postJson(path: string, body: unknown) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${path} failed: ${response.status}`);
  return response.json();
}

async function getJson(path: string) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`${path} failed: ${response.status}`);
  return response.json();
}

function App() {
  const [result, setResult] = useState<RunResult | null>(null);
  const [factoryState, setFactoryState] = useState<FactoryState | null>(null);
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus>(fallbackIntegrationStatus);
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
  const latestScenario = String(factoryState?.metadata?.scenario ?? "not loaded");
  const statusItems = [`API: ${API_BASE}`, ...Object.entries(integrationStatus).map(([name, status]) => `${name}: ${status}`)];
  const topology = result?.selected_topology ?? "high_risk_review";
  const flow = useMemo(() => buildFlow(topology), [topology]);
  const chartData = result?.best_plan.items.map((item) => ({
    name: item.operation_id,
    duration: item.end_minute - item.start_minute
  })) ?? [];

  useEffect(() => {
    void bootDemo();
  }, []);

  function appendLog(message: string) {
    const time = new Date().toLocaleTimeString();
    setRunLog((previous) => [`${time} ${message}`, ...previous].slice(0, 6));
  }

  async function bootDemo() {
    try {
      await refreshState();
    } finally {
      await runScenario("main");
    }
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
      setResult(payload);
      await refreshState();
      appendLog(`scenario ${scenario} -> ${payload.selected_topology}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
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
      appendLog("event machine_alert M3");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
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
      appendLog("event order_created O4");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
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
      setResult(null);
      await refreshState();
      appendLog("demo reset");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setError(message);
      appendLog(message);
      setBusy(false);
      return;
    }
    setBusy(false);
    await runScenario("normal");
  }

  return (
    <main>
      <header className="topbar">
        <div>
          <h1>DynaTwin-Swarm</h1>
          <p>Industrial digital twin scheduling dashboard</p>
        </div>
        <div className="status-strip">
          {statusItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </header>

      <section className="toolbar">
        <button onClick={() => runScenario("normal")} disabled={busy} title="Run Normal Scheduling"><Play size={17} />Run Normal Scheduling</button>
        <button onClick={triggerMachineAlert} disabled={busy} title="Trigger M3 Overheat"><Thermometer size={17} />Trigger M3 Overheat</button>
        <button onClick={createUrgentOrder} disabled={busy} title="Create Urgent Order O4"><Plus size={17} />Create Urgent Order O4</button>
        <button onClick={() => runScenario("main")} disabled={busy} title="Run Composite Incident Demo"><Zap size={17} />Run Composite Incident Demo</button>
        <button onClick={resetDemo} disabled={busy} title="Reset Demo"><RotateCcw size={17} />Reset Demo</button>
      </section>

      <section className="run-strip">
        <span>{busy ? "Running" : "Ready"}</span>
        <span>Scenario: {latestScenario}</span>
        <span>Machines: {machines.length}</span>
        <span>Orders: {orders.length}</span>
        <span>Operations: {operationCount}</span>
        <span>Alerts: {alertCount}</span>
      </section>

      {error && <div className="error">{error}</div>}

      <section className="grid overview">
        <Panel title="Machines" icon={<Factory size={18} />}>
          <div className="machine-grid">
            {machines.map((machine) => (
              <div className={`machine ${machine.status}`} key={machine.id}>
                <strong>{machine.id}</strong>
                <span>{machine.name}</span>
                <small>{machine.status} - {Math.round(machine.temperature_c)}C</small>
                <small>{machine.current_order_id ? `job ${machine.current_order_id}` : machine.capabilities?.join(", ")}</small>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Orders" icon={<Clock size={18} />}>
          <table>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.id}</td>
                  <td><span className={`pill ${order.priority}`}>{order.priority}</span></td>
                  <td>{minuteLabel(order.due_minute)}</td>
                  <td>{order.operations.length} ops</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Inventory" icon={<Boxes size={18} />}>
          {materials.map((material) => (
            <div className="material" key={material.id}>
              <span>{material.name}</span>
              <strong>{material.quantity - material.reserved}/{material.quantity} {material.unit}</strong>
            </div>
          ))}
        </Panel>
        <Panel title="Risk" icon={<AlertTriangle size={18} />}>
          <div className={`risk ${String(result?.task_profile?.risk_level ?? "critical").toLowerCase()}`}>{String(result?.task_profile?.risk_level ?? "critical")}</div>
          <p>{result?.topology_selection?.reason ?? "high-risk equipment anomaly requires risk and critic review"}</p>
        </Panel>
      </section>

      <section className="split">
        <Panel title="Dynamic Agent Topology" icon={<GitBranch size={18} />}>
          <div className="flow-wrap">
            <ReactFlow nodes={flow.nodes} edges={flow.edges} fitView nodesDraggable={false} nodesConnectable={false}>
              <Background />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
        </Panel>
        <Panel title="ReflAct Decisions" icon={<Activity size={18} />}>
          <div className="trace-list">
            {(result?.agent_traces ?? []).slice(0, 8).map((trace) => (
              <div className="trace" key={trace.agent_name}>
                <div><strong>{trace.agent_name}</strong><span>{trace.decision.risk_level} - {Math.round(trace.decision.confidence * 100)}%</span></div>
                <p>{trace.decision.recommended_action}</p>
                {trace.decision.evidence?.[0] && <small className="provider-note">{trace.decision.evidence[0]}</small>}
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="split lower">
        <Panel title="Gantt Schedule" icon={<Clock size={18} />}>
          <div className="gantt">
            {(result?.best_plan.items ?? []).map((item) => (
              <div className="gantt-row" key={item.operation_id}>
                <span>{item.operation_id}</span>
                <div><b style={{ left: `${Math.min(90, item.start_minute / 8)}%`, width: `${Math.max(6, (item.end_minute - item.start_minute) / 4)}%` }}>{item.machine_id} {minuteLabel(item.start_minute)}-{minuteLabel(item.end_minute)}</b></div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Metrics" icon={<Activity size={18} />}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="duration" fill="#2f7d6d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </section>

      <section className="grid detail">
        <Panel title="Alternative Plans" icon={<GitBranch size={18} />}>
          {(result?.alternative_plans ?? []).map((plan, index) => <p key={index}>{plan.objective}: {plan.items.length} operations</p>)}
        </Panel>
        <Panel title="Event Stream" icon={<Activity size={18} />}>
          <div className="events">{displayEvents.map((event, index) => <code key={index}>{JSON.stringify(event)}</code>)}</div>
        </Panel>
        <Panel title="History" icon={<Clock size={18} />}>
          <p>{result?.task_id ?? "No task yet"}</p>
          <p>{result?.selected_topology ?? "Waiting for run"}</p>
          <div className="events">{runLog.map((entry) => <code key={entry}>{entry}</code>)}</div>
        </Panel>
      </section>
    </main>
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
