import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import ReactFlow, { Background, Edge, MarkerType, Node } from "reactflow";
import "reactflow/dist/style.css";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Database,
  Factory,
  Gauge,
  HelpCircle,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Server,
  X,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "./styles.css";

type TabKey = "realtime" | "benchmark" | "agents";
type NoticeType = "success" | "warning" | "error" | "info";

type Machine = {
  id: string;
  name: string;
  status: string;
  temperature_c: number;
  current_order_id?: string | null;
  capability?: string;
  efficiency?: number;
};

type Operation = {
  id: string;
  required_capability?: string;
  duration_minutes?: number;
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
};

type InventoryItem = {
  id?: string;
  material_id?: string;
  name?: string;
  quantity?: number;
  available?: number;
  required?: number;
  unit?: string;
};

type FactoryState = {
  now_minute?: number;
  machines?: Machine[];
  orders?: Order[];
  alerts?: AlertItem[];
  inventory?: InventoryItem[] | Record<string, number | InventoryItem>;
  metadata?: Record<string, unknown>;
};

type ScheduleItem = {
  order_id: string;
  operation_id: string;
  machine_id: string;
  start_minute: number;
  end_minute: number;
  status?: string;
};

type Trace = {
  agent_name: string;
  provider?: string;
  decision: {
    current_state?: string;
    goal?: string;
    gap?: string;
    risk_level?: string;
    recommended_action?: string;
    evidence?: string[];
    confidence?: number;
  };
};

type RunResult = {
  state?: FactoryState;
  selected_topology?: string;
  topology_selection?: {
    topology_name?: string;
    reason?: string;
    confidence?: number;
    metadata?: Record<string, unknown>;
  };
  task_profile?: Record<string, unknown>;
  agent_traces?: Trace[];
  best_plan?: { items?: ScheduleItem[]; metrics?: Record<string, unknown> };
  metrics?: Record<string, unknown>;
};

type PublicDataset = {
  id: string;
  name: string;
  family?: string;
  source?: string;
  source_url?: string;
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
  history?: { episode?: number; reward?: number; topology?: string; advantage?: number }[];
  baselines?: Record<string, unknown> | { name?: string; system?: string; description?: string; reward?: number }[];
  probabilities?: Record<string, number>;
};

type IntegrationStatus = Record<string, string>;

type Notice = {
  id: string;
  type: NoticeType;
  message: string;
  durationMs: number;
};

const API_BASE = (import.meta.env.VITE_API_BASE || "http://127.0.0.1:8010").replace(/\/$/, "");
const ERROR_TEXT = "数据加载失败，请检查后端服务";
const HISTORY_KEY = "dynatwin_topology_history";
const MACHINE_COLORS = ["#00B4D8", "#06D6A0", "#F4A261", "#FF6B35", "#8A5CF6", "#3DDC97", "#4CC9F0", "#C77DFF", "#90BE6D", "#F9C74F"];
const TOPOLOGY_COLORS = ["#64748B", "#00B4D8", "#06D6A0", "#F4A261", "#FF6B35", "#8A5CF6"];

const serviceNames = ["API", "PanguLM", "MindIE", "GaussDB", "OBS", "IoTDA", "EventGrid", "FunctionGraph", "ModelArts"];

const topologyLabel: Record<string, string> = {
  serial_chain: "串行链",
  parallel_fusion: "并行汇聚",
  hierarchical_tree: "层级树",
  supervisor_tree: "层级树",
  full_mesh: "全连接",
  fully_connected: "全连接",
  high_risk_review: "高风险审查",
};

const topologyEdges: Record<string, [string, string][]> = {
  serial_chain: [["TaskRouter", "Monitor"], ["Monitor", "Schedule"], ["Schedule", "Constraint"], ["Constraint", "Report"]],
  parallel_fusion: [
    ["TaskRouter", "Monitor"],
    ["Monitor", "Diagnosis"],
    ["Monitor", "Order"],
    ["Monitor", "Resource"],
    ["Diagnosis", "Schedule"],
    ["Order", "Schedule"],
    ["Resource", "Schedule"],
    ["Schedule", "Constraint"],
    ["Constraint", "Report"],
  ],
  supervisor_tree: [
    ["TaskRouter", "Supervisor"],
    ["Supervisor", "Diagnosis"],
    ["Supervisor", "Order"],
    ["Supervisor", "Resource"],
    ["Supervisor", "Risk"],
    ["Diagnosis", "Schedule"],
    ["Order", "Schedule"],
    ["Resource", "Schedule"],
    ["Risk", "Schedule"],
    ["Schedule", "Constraint"],
    ["Constraint", "Critic"],
    ["Critic", "Report"],
  ],
  hierarchical_tree: [
    ["TaskRouter", "Supervisor"],
    ["Supervisor", "Diagnosis"],
    ["Supervisor", "Order"],
    ["Supervisor", "Resource"],
    ["Supervisor", "Risk"],
    ["Risk", "Schedule"],
    ["Schedule", "Report"],
  ],
  full_mesh: [
    ["TaskRouter", "Monitor"],
    ["TaskRouter", "Diagnosis"],
    ["TaskRouter", "Order"],
    ["TaskRouter", "Resource"],
    ["Monitor", "Schedule"],
    ["Diagnosis", "Schedule"],
    ["Order", "Schedule"],
    ["Resource", "Schedule"],
    ["Schedule", "Risk"],
    ["Risk", "Critic"],
    ["Critic", "Report"],
  ],
  fully_connected: [
    ["TaskRouter", "Monitor"],
    ["TaskRouter", "Diagnosis"],
    ["TaskRouter", "Order"],
    ["TaskRouter", "Resource"],
    ["Monitor", "Schedule"],
    ["Diagnosis", "Schedule"],
    ["Order", "Schedule"],
    ["Resource", "Schedule"],
    ["Schedule", "Risk"],
    ["Risk", "Critic"],
    ["Critic", "Report"],
  ],
  high_risk_review: [
    ["TaskRouter", "Monitor"],
    ["Monitor", "Diagnosis"],
    ["Monitor", "Order"],
    ["Monitor", "Resource"],
    ["Diagnosis", "Schedule"],
    ["Order", "Schedule"],
    ["Resource", "Schedule"],
    ["Schedule", "Constraint"],
    ["Constraint", "Risk"],
    ["Risk", "Critic"],
    ["Critic", "Report"],
  ],
};

const nodeLabel: Record<string, string> = {
  TaskRouter: "任务路由",
  Supervisor: "监督调度",
  Monitor: "设备监控",
  Diagnosis: "故障诊断",
  Order: "订单分析",
  Resource: "资源分配",
  Schedule: "调度求解",
  Constraint: "约束验证",
  Risk: "风险评估",
  Critic: "决策审核",
  FinalDecision: "决策审核",
  Report: "报告生成",
};

const agentRole: Record<string, string> = {
  TaskRouter: "识别任务类型并选择最优协作拓扑",
  Monitor: "扫描所有机器状态并标记需隔离的故障设备",
  Diagnosis: "分析故障影响范围并从候选机器中移除故障设备",
  Order: "评估订单优先级和截止压力",
  Resource: "在可用机器间分配生产资源并解决冲突",
  Schedule: "调用CP-SAT求解器计算最优排程方案",
  Constraint: "检查排程是否违反生产约束",
  Risk: "综合评估当前方案的风险等级",
  Critic: "对最终方案进行一致性校验",
  Report: "汇总所有智能体决策输出最终调度报告",
};

const riskLabel: Record<string, string> = {
  low: "低风险",
  normal: "低风险",
  medium: "中等风险",
  high: "高风险",
  critical: "极高风险",
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

const translationRules: { match: RegExp; value: string }[] = [
  { match: /route to high_risk_review/i, value: "路由到高风险审查拓扑，先隔离异常再进入审核链路。" },
  { match: /route to parallel/i, value: "路由到并行分析拓扑，让多个智能体同时评估设备、订单和资源。" },
  { match: /route to serial/i, value: "路由到串行链拓扑，用轻量流程完成常规排产。" },
  { match: /parallel analysis topology/i, value: "面向大规模基准任务，进入并行分析拓扑以减少决策瓶颈。" },
  { match: /classify the industrial task/i, value: "识别工业任务类型，并选择合适的智能体协作拓扑。" },
  { match: /no safety freeze required/i, value: "当前不需要安全冻结，可以继续执行调度。" },
  { match: /invoke cp-sat/i, value: "调用 CP-SAT 求解器，在安全、库存、交期和技能约束下计算排程方案。" },
  { match: /parallelization and beam-search/i, value: "调用带并行化和束搜索启发式的大规模排程求解流程。" },
  { match: /validate machine capacity/i, value: "校验机器能力、故障隔离、工序先后、库存、技能、交期和安全约束。" },
  { match: /require critic review/i, value: "需要进入决策审核，并保留备用排程方案。" },
  { match: /report selected topology/i, value: "汇总拓扑选择、智能体决策链、最优方案、备选方案和风险状态。" },
  { match: /resolve material shortage/i, value: "处理物料短缺和机器容量冲突。" },
  { match: /inspect machine/i, value: "扫描设备健康状态，识别异常设备。" },
  { match: /monitor equipment.*orders.*inventory/i, value: "监控设备、订单、库存及人员可用性。" },
  { match: /diagnose machine fault/i, value: "诊断机器故障和安全运行能力。" },
  { match: /assess due date.*urgent/i, value: "评估订单截止时间和紧急订单压力。" },
  { match: /detect material.*worker.*machine/i, value: "检测物料、工人和机器资源冲突。" },
  { match: /prepare inputs.*industrial.*solver/i, value: "为工业调度求解器准备输入数据。" },
  { match: /ensure final schedule.*hard production/i, value: "确保最终排程满足所有硬性生产约束。" },
  { match: /summarize operational risk/i, value: "在最终审批前汇总运营风险。" },
  { match: /critique.*proposed schedule/i, value: "审核提议的排程方案，拒绝不安全的捷径。" },
  { match: /produce.*auditable.*industrial.*report/i, value: "生成可审计的工业调度报告。" },
  { match: /freeze unsafe machine/i, value: "冻结不安全机器并在调度前发布告警。" },
  { match: /remove.*candidate machine/i, value: "从候选机器中移除故障机器，重新路由工单。" },
  { match: /prioritize urgent.*due.date/i, value: "按截止时间优先处理紧急订单。" },
  { match: /current capacity.*safety state.*diverges/i, value: "当前产能与安全状态偏离安全准时生产目标。" },
  { match: /state is close to.*production goal/i, value: "当前状态接近生产目标，无需额外干预。" },
  { match: /reject any plan using failed equipment/i, value: "拒绝使用故障设备或未经验证库存的排程方案。" },
  { match: /approve the safest feasible decision/i, value: "经风险和审核评估后，批准最安全可行的决策。" },
  { match: /classic 6-machine.*6-job/i, value: "经典6机器6作业车间调度基准，用于验证调度算法。" },
  { match: /analyze failure/i, value: "分析故障影响范围，并隔离不可用机器。" },
  { match: /evaluate order/i, value: "评估订单优先级、截止时间和生产压力。" },
];

async function getJson(path: string) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(ERROR_TEXT);
  return response.json();
}

async function postJson(path: string, body: unknown = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(ERROR_TEXT);
  return response.json();
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function sanitizeText(value?: unknown): string {
  if (Array.isArray(value)) return value.map((item) => sanitizeText(item)).filter(Boolean).join("；");
  return String(value ?? "暂无")
    .replace(/\bmock\s*:\s*/gi, "")
    .replace(/\blocal\s+fallback\s*:\s*/gi, "")
    .replace(/\bfallback\s*:\s*/gi, "")
    .trim();
}

function translateText(value?: unknown) {
  const original = sanitizeText(value);
  for (const rule of translationRules) {
    if (rule.match.test(original)) return rule.value;
  }
  return original;
}

function translateCurrentState(value?: unknown) {
  const text = sanitizeText(value);
  const machines = text.match(/machines\s*[:=]\s*(\d+)/i)?.[1];
  const failed = text.match(/failed\s*[:=]\s*(\d+)/i)?.[1];
  const urgent = text.match(/urgent_orders\s*[:=]\s*(\d+)/i)?.[1];
  const alerts = text.match(/alerts\s*[:=]\s*(\d+)/i)?.[1];
  if (machines || failed || urgent || alerts) {
    return [
      machines ? `当前共有 ${machines} 台机器` : "",
      failed ? `${failed} 台故障` : "",
      urgent ? `${urgent} 个紧急订单` : "",
      alerts ? `${alerts} 条告警` : "",
    ].filter(Boolean).join("，");
  }
  return text
    .replace(/machines/gi, "台机器")
    .replace(/failed/gi, "故障")
    .replace(/urgent_orders/gi, "紧急订单")
    .replace(/alerts/gi, "条告警")
    .replace(/[():]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasEnglish(value: string) {
  return /[A-Za-z]{4,}/.test(value);
}

function minuteLabel(minute: number) {
  return `${Math.max(0, Math.round(minute))} 分钟`;
}

function planMakespan(items: ScheduleItem[], metrics?: Record<string, unknown>) {
  const metricMakespan = Number(metrics?.makespan);
  if (Number.isFinite(metricMakespan) && metricMakespan > 0) return metricMakespan;
  return Math.max(0, ...items.map((item) => item.end_minute));
}

function formatGap(makespan: number, bestKnown?: number | null) {
  if (!bestKnown) return "-";
  return `${(((makespan - bestKnown) / bestKnown) * 100).toFixed(1)}%`;
}

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function statusConnected(name: string, status?: string, apiReady = false) {
  if (name === "API") return apiReady;
  const text = String(status ?? "").toLowerCase();
  return Boolean(text && !/(mock|fallback|local|sqlite)/.test(text) && /(connected|online|ready|enabled)/.test(text));
}

function riskTriggers(state: FactoryState | null, orders: Order[]) {
  const machines = state?.machines ?? [];
  const alerts = state?.alerts ?? [];
  const failedCount = machines.filter((machine) => machine.status === "failed").length;
  const alertCount = alerts.length;
  const urgentCount = orders.filter((order) => ["urgent", "high"].includes(order.priority)).length;
  const busyCount = machines.filter((machine) => machine.status === "busy").length;
  const utilization = machines.length ? busyCount / machines.length : 0;
  const triggers = [];
  if (failedCount >= 2) triggers.push(`多台设备同时故障：${failedCount} 台`);
  if (failedCount >= 1) triggers.push(`存在设备故障：${failedCount} 台`);
  if (alertCount >= 3) triggers.push(`告警数达到 ${alertCount} 条`);
  if (alertCount >= 1) triggers.push(`存在告警：${alertCount} 条`);
  if (urgentCount >= 1) triggers.push(`存在紧急或高优先级订单：${urgentCount} 个`);
  if (utilization > 0.85) triggers.push(`设备利用率 ${Math.round(utilization * 100)}%`);
  return { failedCount, alertCount, urgentCount, utilization, text: triggers.length ? triggers.join("；") : "无故障、无告警、无紧急订单" };
}

function riskFromState(state: FactoryState | null, orders: Order[], forcedRisk: string | null, result: RunResult | null) {
  if (forcedRisk) return forcedRisk;
  const triggers = riskTriggers(state, orders);
  if (triggers.failedCount >= 2) return "critical";
  if (triggers.failedCount >= 1 || triggers.alertCount >= 3) return "high";
  if (triggers.urgentCount >= 1 || triggers.alertCount >= 1 || triggers.utilization > 0.85) return "medium";
  const resultRisk = result?.task_profile?.risk_level;
  return typeof resultRisk === "string" ? resultRisk : "low";
}

function bannerCopy(risk: string) {
  if (risk === "medium") return { className: "bg-amber-500/15 border-amber-500/30 text-amber-400", text: "存在中等风险，建议关注" };
  if (risk === "high" || risk === "critical") return { className: "bg-destructive/15 border-destructive/30 text-destructive animate-pulse", text: "检测到高风险事件，已自动切换调度拓扑" };
  return { className: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400", text: "系统运行正常" };
}

function canonicalAgent(name: string) {
  return name.replace(/Agent$/, "").replace("FinalDecision", "Critic");
}

function actionMapFromTraces(traces: Trace[]) {
  return traces.reduce<Record<string, string>>((acc, trace) => {
    acc[canonicalAgent(trace.agent_name)] = sanitizeText(trace.decision.recommended_action);
    return acc;
  }, {});
}

function traceNodeSequence(traces: Trace[]) {
  return traces.map((trace) => canonicalAgent(trace.agent_name)).filter(Boolean);
}

function cooperationText(topology: string, nodes: Node[]) {
  const names = nodes.map((node) => String(node.data?.plainLabel ?? nodeLabel[node.id] ?? node.id));
  const flow = names.join(" → ");
  if (topology === "parallel_fusion") return `多个智能体并行分析设备、订单和资源，再汇聚到调度求解与约束验证。执行顺序：${flow}`;
  if (topology === "high_risk_review") return `异常场景进入风险评估和决策审核，先隔离风险再输出最终方案。执行顺序：${flow}`;
  if (topology === "supervisor_tree" || topology === "hierarchical_tree") return `监督节点先分派诊断、订单、资源和风险任务，再汇总进入调度求解。执行顺序：${flow}`;
  if (topology === "full_mesh" || topology === "fully_connected") return `关键智能体充分互联共享上下文，适合复杂多约束协商。执行顺序：${flow}`;
  return `低风险任务采用轻量串行链路，减少不必要的智能体调用。执行顺序：${flow}`;
}

function normalizeRunPayload(payload: RunResult): RunResult {
  const nested = (payload as { result?: RunResult; run?: RunResult }).result ?? (payload as { run?: RunResult }).run;
  return nested ? { ...nested, state: nested.state ?? payload.state } : payload;
}

function extractScheduleItems(payload: unknown): ScheduleItem[] {
  const candidate = payload as {
    items?: ScheduleItem[];
    best_plan?: { items?: ScheduleItem[] };
    schedule?: { items?: ScheduleItem[] };
  };
  return candidate.items ?? candidate.best_plan?.items ?? candidate.schedule?.items ?? [];
}

function extractIntegrations(payload: unknown): IntegrationStatus {
  const candidate = payload as { status?: IntegrationStatus; services?: IntegrationStatus };
  return candidate?.status ?? candidate?.services ?? (candidate as IntegrationStatus) ?? {};
}

function inventoryRows(state: FactoryState | null): InventoryItem[] {
  const inventory = state?.inventory;
  if (!inventory) return [];
  if (Array.isArray(inventory)) return inventory;
  return Object.entries(inventory).map(([key, value]) => {
    if (typeof value === "number") return { id: key, name: key, quantity: value };
    return { id: key, ...value };
  });
}

function confidencePercent(value?: number) {
  if (!Number.isFinite(value)) return 78;
  const numberValue = Number(value);
  return Math.round(numberValue <= 1 ? numberValue * 100 : numberValue);
}

function topologyCounts(history: string[]) {
  const counts = history.reduce<Record<string, number>>((acc, topology) => {
    acc[topology] = (acc[topology] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([name, value]) => ({ name: topologyLabel[name] ?? name, value }));
}

function baselineRows(experiment: ExperimentPayload) {
  if (Array.isArray(experiment.baselines)) {
    return experiment.baselines.map((row, index) => ({
      name: row.system ?? row.name ?? `基线 ${index + 1}`,
      description: row.description ?? "实验返回的基线系统",
      reward: Number(row.reward ?? 0),
    }));
  }
  if (experiment.baselines && typeof experiment.baselines === "object") {
    return Object.entries(experiment.baselines).map(([name, value]) => {
      if (typeof value === "number") return { name, description: "实验返回的基线系统", reward: value };
      const row = value as { description?: string; reward?: number };
      return { name, description: row.description ?? "实验返回的基线系统", reward: Number(row.reward ?? 0) };
    });
  }
  const latestReward = experiment.history?.[experiment.history.length - 1]?.reward;
  return latestReward === undefined
    ? []
    : [{ name: "A2C Top-K + ML Selector + ReflAct", description: "当前系统", reward: Number(latestReward) }];
}

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("realtime");
  const [state, setState] = useState<FactoryState | null>(null);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [topology, setTopology] = useState("serial_chain");
  const [topologyReason, setTopologyReason] = useState("等待调度结果");
  const [datasets, setDatasets] = useState<PublicDataset[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationStatus>({});
  const [experiment, setExperiment] = useState<ExperimentPayload>({});
  const [a2cStatus, setA2cStatus] = useState<ExperimentPayload>({});
  const [benchmarkRows, setBenchmarkRows] = useState<BenchmarkRow[]>([]);
  const [topologyHistory, setTopologyHistory] = useState<string[]>(() => loadHistory());
  const [loading, setLoading] = useState(true);
  const [runningAction, setRunningAction] = useState("");
  const [runningDatasetId, setRunningDatasetId] = useState("");
  const [runningA2c, setRunningA2c] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [autoRun, setAutoRun] = useState(true);
  const [forcedRisk, setForcedRisk] = useState<string | null>(null);
  const [forcedMachineFailure, setForcedMachineFailure] = useState(false);
  const [pendingUrgentOrder, setPendingUrgentOrder] = useState<Order | null>(null);
  const [urgentFlashKey, setUrgentFlashKey] = useState(0);
  const [activeNodes, setActiveNodes] = useState<Set<string>>(new Set());
  const [activeEdges, setActiveEdges] = useState<Set<string>>(new Set());
  const [notices, setNotices] = useState<Notice[]>([]);
  const [bumpKey, setBumpKey] = useState(0);
  const animationTimers = useRef<number[]>([]);

  useEffect(() => {
    initializePage();
    return () => {
      animationTimers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (!autoRun) return;
    const stateTimer = window.setInterval(() => {
      refreshStateOnly();
    }, 5000);
    const runTimer = window.setInterval(() => {
      runTaskCycle("main", false);
    }, 30000);
    return () => {
      window.clearInterval(stateTimer);
      window.clearInterval(runTimer);
    };
  }, [autoRun]);

  const visibleMachines = useMemo(() => {
    const machines = state?.machines ?? [];
    if (!forcedMachineFailure) return machines;
    return machines.map((machine) =>
      machine.id === "M3" ? { ...machine, status: "failed", temperature_c: Math.max(machine.temperature_c, 96) } : machine,
    );
  }, [state, forcedMachineFailure]);

  const visibleOrders = useMemo(() => {
    const orders = [...(state?.orders ?? [])];
    if (pendingUrgentOrder && !orders.some((order) => order.id === pendingUrgentOrder.id)) {
      orders.unshift(pendingUrgentOrder);
    }
    return orders.sort((a, b) => {
      const score = (order: Order) => (order.priority === "urgent" ? 0 : order.priority === "high" ? 1 : 2);
      return score(a) - score(b);
    });
  }, [state, pendingUrgentOrder]);

  const risk = riskFromState({ ...state, machines: visibleMachines }, visibleOrders, forcedRisk, result);
  const banner = bannerCopy(risk);
  const makespan = planMakespan(scheduleItems, result?.best_plan?.metrics ?? result?.metrics);
  const estimatedFinish = makespan ? minuteLabel(makespan) : "暂无";
  const actionByNode = useMemo(() => actionMapFromTraces(traces), [traces]);
  const flow = useMemo(() => buildFlow(topology, risk, actionByNode, activeNodes, activeEdges), [topology, risk, actionByNode, activeNodes, activeEdges]);
  const rewardHistory = experiment.history ?? [];
  const a2cPie = useMemo(() => {
    if (a2cStatus.probabilities && Object.keys(a2cStatus.probabilities).length) {
      return Object.entries(a2cStatus.probabilities).map(([name, value]) => ({
        name: topologyLabel[name] ?? name,
        value: Number((value * 100).toFixed(1)),
      }));
    }
    return topologyCounts(topologyHistory);
  }, [a2cStatus, topologyHistory]);
  const riskTip = `风险等级计算依据：低风险=无故障无告警；中等风险=存在紧急订单或告警数≥1或设备利用率>85%；高风险=存在设备故障或告警数≥3；极高风险=多台设备同时故障。当前触发条件：${riskTriggers({ ...state, machines: visibleMachines }, visibleOrders).text}`;
  const finishTip = `完工时间=CP-SAT约束规划求解器计算所有订单最优排程后，取最晚结束工序的end_minute值。当前数值来源于best_plan.items中最大的end_minute字段。`;

  function showNotice(type: NoticeType, message: string, durationMs = 5000) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setNotices((previous) => [...previous, { id, type, message, durationMs }]);
    window.setTimeout(() => {
      setNotices((previous) => previous.filter((notice) => notice.id !== id));
    }, durationMs);
  }

  function removeNotice(id: string) {
    setNotices((previous) => previous.filter((notice) => notice.id !== id));
  }

  function notifyApiError() {
    showNotice("error", ERROR_TEXT);
  }

  function recordTopology(nextTopology: string) {
    setTopologyHistory((previous) => {
      const next = [nextTopology, ...previous].slice(0, 60);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function initializePage() {
    setLoading(true);
    try {
      const [statePayload, tracesPayload, topologyPayload, statusPayload, schedulePayload, datasetsPayload, experimentPayload] = await Promise.all([
        getJson("/api/state"),
        getJson("/api/traces/latest"),
        getJson("/api/topology/latest"),
        getJson("/api/integrations/status"),
        getJson("/api/schedules/latest"),
        getJson("/api/datasets/public"),
        getJson("/api/experiments/latest"),
      ]);
      setApiReady(true);
      applyStatePayload(statePayload);
      setTraces(Array.isArray(tracesPayload?.agent_traces) ? tracesPayload.agent_traces : []);
      applyTopologyPayload(topologyPayload);
      setIntegrations(extractIntegrations(statusPayload));
      setScheduleItems(extractScheduleItems(schedulePayload));
      setDatasets(Array.isArray(datasetsPayload?.datasets) ? datasetsPayload.datasets : []);
      setExperiment(experimentPayload ?? {});
      refreshA2cStatus(false);
    } catch {
      setApiReady(false);
      notifyApiError();
    } finally {
      setLoading(false);
    }
  }

  function applyStatePayload(payload: FactoryState | { state?: FactoryState }) {
    const nextState = "state" in payload && payload.state ? payload.state : (payload as FactoryState);
    if (nextState && Array.isArray(nextState.machines)) {
      setState(nextState);
      setBumpKey((key) => key + 1);
    }
  }

  function applyTopologyPayload(payload: { topology_name?: string; selected_topology?: string; reason?: string; topology_selection?: { topology_name?: string; reason?: string } }) {
    const name = payload?.topology_name ?? payload?.selected_topology ?? payload?.topology_selection?.topology_name;
    const reason = payload?.reason ?? payload?.topology_selection?.reason;
    if (name) setTopology(name);
    if (reason) setTopologyReason(reason);
  }

  async function refreshStateOnly() {
    try {
      const statePayload = await getJson("/api/state");
      setApiReady(true);
      applyStatePayload(statePayload);
    } catch {
      setApiReady(false);
      notifyApiError();
    }
  }

  async function refreshPanels(showErrors = true) {
    try {
      const [statePayload, tracesPayload, topologyPayload, statusPayload, schedulePayload, experimentPayload] = await Promise.all([
        getJson("/api/state"),
        getJson("/api/traces/latest"),
        getJson("/api/topology/latest"),
        getJson("/api/integrations/status"),
        getJson("/api/schedules/latest"),
        getJson("/api/experiments/latest"),
      ]);
      setApiReady(true);
      applyStatePayload(statePayload);
      setTraces(Array.isArray(tracesPayload?.agent_traces) ? tracesPayload.agent_traces : []);
      applyTopologyPayload(topologyPayload);
      setIntegrations(extractIntegrations(statusPayload));
      setScheduleItems(extractScheduleItems(schedulePayload));
      setExperiment(experimentPayload ?? {});
    } catch {
      setApiReady(false);
      if (showErrors) notifyApiError();
    }
  }

  async function refreshA2cStatus(showErrors = false) {
    try {
      const payload = await getJson("/api/experiments/a2c_status");
      setA2cStatus(payload ?? {});
    } catch {
      if (showErrors) notifyApiError();
    }
  }

  async function applyRunResult(payload: RunResult, shouldRefresh = true) {
    const normalized = normalizeRunPayload(payload);
    setResult(normalized);
    if (normalized.state) applyStatePayload(normalized.state);
    const selected = normalized.selected_topology || normalized.topology_selection?.topology_name || "serial_chain";
    setTopology(selected);
    setTopologyReason(normalized.topology_selection?.reason || "本次调度未返回切换原因");
    setTraces(normalized.agent_traces ?? []);
    setScheduleItems(normalized.best_plan?.items ?? []);
    recordTopology(selected);
    playTraceAnimation(normalized.agent_traces ?? []);
    setBumpKey((key) => key + 1);
    if (shouldRefresh) await refreshPanels(false);
  }

  async function runTaskCycle(scenario = "main", showErrors = true) {
    try {
      const payload = await postJson("/api/tasks/run", { scenario });
      await applyRunResult(payload);
    } catch {
      if (showErrors) notifyApiError();
    }
  }

  function playTraceAnimation(nextTraces: Trace[]) {
    animationTimers.current.forEach((timer) => window.clearTimeout(timer));
    animationTimers.current = [];
    setActiveNodes(new Set());
    setActiveEdges(new Set());
    const sequence = traceNodeSequence(nextTraces);
    const highlighted = new Set<string>();
    const highlightedEdges = new Set<string>();
    sequence.forEach((node, index) => {
      const timer = window.setTimeout(() => {
        highlighted.add(node);
        if (index > 0) highlightedEdges.add(`${sequence[index - 1]}-${node}`);
        setActiveNodes(new Set(highlighted));
        setActiveEdges(new Set(highlightedEdges));
      }, index * 600);
      animationTimers.current.push(timer);
    });
    const clearTimer = window.setTimeout(() => {
      setActiveNodes(new Set());
      setActiveEdges(new Set());
    }, sequence.length * 600 + 3000);
    animationTimers.current.push(clearTimer);
  }

  async function triggerFailure(showMessage = true) {
    setRunningAction("failure");
    setForcedRisk("high");
    setForcedMachineFailure(true);
    try {
      const eventPayload = await postJson("/api/events/machine-alert", { machine_id: "M3" });
      await wait(200);
      if ((eventPayload as RunResult).agent_traces || (eventPayload as RunResult).best_plan) {
        await applyRunResult(eventPayload, true);
      } else {
        const payload = await postJson("/api/tasks/run", { scenario: "single_machine_failure" });
        await applyRunResult(payload);
      }
      if (showMessage) showNotice("warning", "⚠️ M3设备过热告警，系统已自动切换至高风险审查拓扑，受影响订单已重新排程");
    } catch {
      notifyApiError();
    } finally {
      setRunningAction("");
    }
  }

  async function insertUrgentOrder(showMessage = true) {
    setRunningAction("urgent");
    const urgentOrder: Order = {
      id: "O_URGENT",
      priority: "urgent",
      due_minute: 450,
      operations: [
        { id: "O_URGENT-CUT", required_capability: "cutting", duration_minutes: 35 },
        { id: "O_URGENT-MILL", required_capability: "precision", duration_minutes: 70 },
      ],
    };
    setPendingUrgentOrder(urgentOrder);
    setUrgentFlashKey((key) => key + 1);
    try {
      const eventPayload = await postJson("/api/events/order-created", { order_id: "O_URGENT" });
      await wait(200);
      if ((eventPayload as RunResult).agent_traces || (eventPayload as RunResult).best_plan) {
        await applyRunResult(eventPayload, true);
      } else {
        const payload = await postJson("/api/tasks/run", { scenario: "multi_resource_conflict" });
        await applyRunResult(payload);
      }
      if (showMessage) showNotice("warning", "🚨 紧急订单已插入，系统已重新计算排程方案");
    } catch {
      notifyApiError();
    } finally {
      setRunningAction("");
    }
  }

  async function runCompositeDemo() {
    setRunningAction("composite");
    await triggerFailure(true);
    await wait(1000);
    await insertUrgentOrder(true);
    setRunningAction("");
  }

  async function resetDemo() {
    setRunningAction("reset");
    try {
      await postJson("/api/demo/reset", {});
      setResult(null);
      setForcedRisk(null);
      setForcedMachineFailure(false);
      setPendingUrgentOrder(null);
      setActiveNodes(new Set());
      setActiveEdges(new Set());
      await refreshPanels();
      showNotice("success", "✅ 系统已重置为初始状态");
    } catch {
      notifyApiError();
    } finally {
      setRunningAction("");
    }
  }

  async function runDataset(dataset: PublicDataset) {
    setRunningDatasetId(dataset.id);
    try {
      const started = performance.now();
      const payload: RunResult = await postJson(`/api/datasets/public/${dataset.id}/run`);
      const elapsed = Math.round(performance.now() - started);
      await applyRunResult(payload);
      const normalized = normalizeRunPayload(payload);
      const items = normalized.best_plan?.items ?? [];
      const metrics = normalized.best_plan?.metrics ?? normalized.metrics ?? {};
      const makespanValue = planMakespan(items, metrics);
      const bestKnown = dataset.best_known_makespan ?? dataset.optimal ?? null;
      const solveTime = Number(normalized.metrics?.solve_time_ms ?? normalized.best_plan?.metrics?.solve_time_ms ?? elapsed);
      setBenchmarkRows((previous) => [
        ...previous,
        {
          id: `${dataset.id}-${Date.now()}`,
          datasetName: dataset.name,
          makespan: makespanValue,
          topology: normalized.selected_topology ?? normalized.topology_selection?.topology_name ?? "serial_chain",
          solveTimeMs: Number.isFinite(solveTime) ? Math.round(solveTime) : elapsed,
          bestKnown,
        },
      ]);
      showNotice("success", `${dataset.name} 求解完成`);
    } catch {
      notifyApiError();
    } finally {
      setRunningDatasetId("");
    }
  }

  async function runA2cTraining() {
    setRunningA2c(true);
    try {
      const payload = await postJson("/api/experiments/run_a2c", {});
      setExperiment(payload ?? {});
      if ((payload as ExperimentPayload).probabilities) setA2cStatus(payload);
      await refreshA2cStatus(false);
      showNotice("success", "A2C训练已完成");
    } catch {
      notifyApiError();
    } finally {
      setRunningA2c(false);
    }
  }

  return (
    <TooltipProvider>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)} className="min-h-screen bg-background text-foreground">
        <header className="fixed left-0 right-0 top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex min-h-[60px] items-center gap-6 px-6">
            <div className="flex min-w-[330px] items-center gap-3">
              <Factory className="h-7 w-7 text-primary" />
              <div>
                <h1 className="text-xl font-bold tracking-normal">DynaTwin-Swarm</h1>
                <p className="text-xs text-muted-foreground">工业数字孪生智能排产系统</p>
              </div>
            </div>

            <TabsList className="mx-auto bg-muted">
              <TabsTrigger value="realtime" className="gap-2"><Factory className="h-4 w-4" />实时调度</TabsTrigger>
              <TabsTrigger value="benchmark" className="gap-2"><Database className="h-4 w-4" />基准测试</TabsTrigger>
              <TabsTrigger value="agents" className="gap-2"><Bot className="h-4 w-4" />智能体决策</TabsTrigger>
            </TabsList>

            <div className="flex max-w-[620px] flex-wrap items-center justify-end gap-2">
              {serviceNames.map((name) => {
                const connected = statusConnected(name, integrations[name], apiReady);
                return (
                  <span key={name} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground">
                    <i className={cn("h-2 w-2 rounded-full", connected ? "animate-pulse bg-emerald-500" : "bg-muted-foreground")} />
                    {name}
                  </span>
                );
              })}
              <Separator orientation="vertical" className="mx-1 h-7" />
              <span className="inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                <i className={cn("h-2 w-2 rounded-full", autoRun ? "animate-pulse bg-emerald-500" : "bg-muted-foreground")} />
                {autoRun ? "自动运行中" : "自动运行暂停"}
              </span>
              <Button variant="outline" size="sm" onClick={() => setAutoRun((value) => !value)}>
                {autoRun ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {autoRun ? "暂停" : "继续"}
              </Button>
            </div>
          </div>
        </header>

        <main className="px-6 pb-8 pt-[72px] pr-16">
          <TabsContent value="realtime">
            <RealtimeTab
              banner={banner}
              topology={topology}
              topologyReason={topologyReason}
              risk={risk}
              riskTip={riskTip}
              finishTip={finishTip}
              orders={visibleOrders}
              urgentFlashKey={urgentFlashKey}
              machines={visibleMachines}
              inventory={inventoryRows(state)}
              scheduleItems={scheduleItems}
              makespan={makespan}
              estimatedFinish={estimatedFinish}
              flow={flow}
              loading={loading}
              bumpKey={bumpKey}
              runningAction={runningAction}
              onFailure={() => triggerFailure(true)}
              onUrgent={() => insertUrgentOrder(true)}
              onComposite={runCompositeDemo}
              onReset={resetDemo}
            />
          </TabsContent>

          <TabsContent value="benchmark">
            <BenchmarkTab
              datasets={datasets}
              rows={benchmarkRows}
              runningDatasetId={runningDatasetId}
              loading={loading}
              onRun={runDataset}
            />
          </TabsContent>

          <TabsContent value="agents">
            <AgentsTab
              traces={traces}
              rewardHistory={rewardHistory}
              topologyPie={a2cPie}
              experiment={experiment}
              loading={loading}
              runningA2c={runningA2c}
              onRunA2c={runA2cTraining}
            />
          </TabsContent>
        </main>

        <NotificationStack notices={notices} onClose={removeNotice} />
      </Tabs>
    </TooltipProvider>
  );
}

function RealtimeTab({
  banner,
  topology,
  topologyReason,
  risk,
  riskTip,
  finishTip,
  orders,
  urgentFlashKey,
  machines,
  inventory,
  scheduleItems,
  makespan,
  estimatedFinish,
  flow,
  loading,
  bumpKey,
  runningAction,
  onFailure,
  onUrgent,
  onComposite,
  onReset,
}: {
  banner: { className: string; text: string };
  topology: string;
  topologyReason: string;
  risk: string;
  riskTip: string;
  finishTip: string;
  orders: Order[];
  urgentFlashKey: number;
  machines: Machine[];
  inventory: InventoryItem[];
  scheduleItems: ScheduleItem[];
  makespan: number;
  estimatedFinish: string;
  flow: { nodes: Node[]; edges: Edge[] };
  loading: boolean;
  bumpKey: number;
  runningAction: string;
  onFailure: () => void;
  onUrgent: () => void;
  onComposite: () => void;
  onReset: () => void;
}) {
  const cooperation = cooperationText(topology, flow.nodes);
  return (
    <section className="space-y-4">
      <div className={cn("flex items-center justify-between gap-6 rounded-md border p-4 transition-all", banner.className)}>
        <div className="flex items-center gap-3">
          <Gauge className="h-6 w-6" />
          <strong className="text-lg">{banner.text}</strong>
        </div>
        <div className="grid min-w-[760px] grid-cols-4 gap-3">
          <Metric label="当前拓扑名称" value={topologyLabel[topology] ?? topology} bumpKey={bumpKey} />
          <Metric label="风险等级" value={riskLabel[risk] ?? risk} tooltip={riskTip} bumpKey={bumpKey} />
          <Metric label="在制订单数" value={`${orders.length}`} bumpKey={bumpKey} />
          <Metric label="完工预估时间" value={estimatedFinish} tooltip={finishTip} bumpKey={bumpKey} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="destructive" size="sm" onClick={onFailure} disabled={Boolean(runningAction)}>
          <AlertTriangle className="h-4 w-4" />
          触发设备故障
        </Button>
        <Button variant="outline" size="sm" className="border-amber-500/50 text-amber-300 hover:bg-amber-500/10" onClick={onUrgent} disabled={Boolean(runningAction)}>
          <Plus className="h-4 w-4" />
          插入紧急订单
        </Button>
        <Button variant="outline" size="sm" className="border-primary/60 text-primary hover:bg-primary/10" onClick={onComposite} disabled={Boolean(runningAction)}>
          <Zap className="h-4 w-4" />
          复合异常演示
        </Button>
        <Button variant="ghost" size="sm" onClick={onReset} disabled={Boolean(runningAction)}>
          <RotateCcw className="h-4 w-4" />
          重置
        </Button>
      </div>

      {runningAction && <SkeletonLine className="h-2" />}

      <div className="grid grid-cols-[60fr_40fr] gap-4">
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Factory className="h-4 w-4 text-primary" />设备状态</CardTitle>
            </CardHeader>
            <CardContent>{loading ? <SkeletonGrid /> : <MachineGrid machines={machines} />}</CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />订单队列</CardTitle>
            </CardHeader>
            <CardContent>{loading ? <SkeletonRows /> : <OrderTable orders={orders} urgentFlashKey={urgentFlashKey} />}</CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="h-4 w-4 text-primary" />物料库存</CardTitle>
            </CardHeader>
            <CardContent>{loading ? <SkeletonRows /> : <InventoryList inventory={inventory} />}</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bot className="h-4 w-4 text-primary" />当前Agent协作拓扑</CardTitle>
            <CardDescription>节点下方展示该智能体最新建议动作。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-[440px] overflow-hidden rounded-md border bg-background">
              <ReactFlow nodes={flow.nodes} edges={flow.edges} fitView nodesDraggable={false} nodesConnectable={false} panOnScroll={false} zoomOnScroll={false}>
                <Background color="hsl(var(--border))" gap={24} size={1} />
              </ReactFlow>
            </div>
            <Card className="bg-background">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-primary">协作模式说明</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p><span className="font-semibold text-foreground">当前协作模式：</span>{topologyLabel[topology] ?? topology}</p>
                <p><span className="font-semibold text-foreground">切换原因：</span>{sanitizeText(topologyReason)}</p>
                <ol className="space-y-1">
                  {cooperation.split("。").filter(Boolean).map((item, index) => (
                    <li key={item} className="flex gap-2">
                      <span className="font-bold text-primary">{index + 1}.</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />CP-SAT排程甘特图</CardTitle>
            <CardDescription className="mt-2 space-y-1">
              <span className="block">纵轴：每行代表一道工序（订单ID-工序编号）</span>
              <span className="block">横轴：时间轴（单位：分钟）</span>
              <span className="block">色块颜色：代表分配的机器，同色=同一台机器加工</span>
            </CardDescription>
          </div>
          <MachineLegend items={scheduleItems} />
        </CardHeader>
        <CardContent>{loading ? <SkeletonRows /> : <GanttChart items={scheduleItems} makespan={makespan} />}</CardContent>
      </Card>
    </section>
  );
}

function BenchmarkTab({
  datasets,
  rows,
  runningDatasetId,
  loading,
  onRun,
}: {
  datasets: PublicDataset[];
  rows: BenchmarkRow[];
  runningDatasetId: string;
  loading: boolean;
  onRun: (dataset: PublicDataset) => void;
}) {
  const chartData = rows.map((row) => ({
    name: row.datasetName,
    本次Makespan: row.makespan,
    最优已知值: row.bestKnown ?? undefined,
  }));
  return (
    <section className="space-y-4">
      {loading ? (
        <SkeletonCards />
      ) : (
        <div className="grid grid-cols-5 gap-4">
          {datasets.slice(0, 5).map((dataset, index) => {
            const bestKnown = dataset.best_known_makespan ?? dataset.optimal ?? null;
            const color = TOPOLOGY_COLORS[index % TOPOLOGY_COLORS.length];
            return (
              <Card key={dataset.id} className="overflow-hidden">
                <div className="h-1" style={{ background: color }} />
                <CardHeader>
                  <CardTitle>{dataset.name}</CardTitle>
                  <CardDescription className="line-clamp-3 min-h-[52px]">{dataset.description ? dataset.description
                    .replace("public Job Shop Scheduling benchmark for medium and large factory scheduling validation.", "公开作业车间调度基准，适用于中大型工厂调度验证。")
                    .replace("public job-shop scheduling benchmark used to validate scheduling algorithms.", "公开作业车间调度基准，用于验证调度算法性能。")
                    .replace("Classic 6-machine, 6-job job-shop scheduling benchmark used to validate scheduling algorithms.", "经典6机器6作业车间调度基准，用于验证调度算法。")
                    .replace("public Job Shop Scheduling benchmark for large factory scheduling validation.", "公开作业车间调度基准，适用于大型工厂调度验证。")
                    : "公开作业车间调度基准数据集"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <DatasetMetric label="作业" value={dataset.job_count} />
                    <DatasetMetric label="机器" value={dataset.machine_count} />
                    <DatasetMetric label="工序" value={dataset.operation_count} />
                    <DatasetMetric label="最优" value={bestKnown ?? "暂无"} />
                  </div>
                  <p className="min-h-[34px] text-xs leading-relaxed text-muted-foreground">{dataset.source ? dataset.source.replace("ScheduleOpt benchmark mirror of classic public Job Shop instances", "ScheduleOpt 经典作业车间标准测试集镜像").replace("Fisher-Thompson 6x6 public job-shop instance, distributed through JSPLib / OR-Library benchmark collections", "Fisher-Thompson 6×6 经典实例，来自 JSPLib / OR-Library 基准集") : "JSSP / OR-Library 标准基准集"}</p>
                  <Button className="w-full" onClick={() => onRun(dataset)} disabled={Boolean(runningDatasetId)}>
                    {runningDatasetId === dataset.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    {runningDatasetId === dataset.id ? "求解中..." : "运行此数据集"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>基准测试对比表</CardTitle>
          <CardDescription>结果会追加到表格中，不会清空已有运行记录。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>数据集</TableHead>
                <TableHead>动态拓扑Makespan</TableHead>
                <TableHead>选用拓扑</TableHead>
                <TableHead>求解耗时(ms)</TableHead>
                <TableHead>最优已知值</TableHead>
                <TableHead>与最优差距%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? rows.map((row, index) => {
                const gap = row.bestKnown ? ((row.makespan - row.bestKnown) / row.bestKnown) * 100 : null;
                return (
                  <TableRow key={row.id} className={cn(index % 2 === 1 && "bg-muted/30")}>
                    <TableCell className="font-medium">{row.datasetName}</TableCell>
                    <TableCell>{row.makespan}</TableCell>
                    <TableCell>{topologyLabel[row.topology] ?? row.topology}</TableCell>
                    <TableCell>{row.solveTimeMs}</TableCell>
                    <TableCell>{row.bestKnown ?? "暂无"}</TableCell>
                    <TableCell className={cn(gap === null ? "text-muted-foreground" : gap < 10 ? "text-emerald-400" : gap < 30 ? "text-amber-400" : "text-destructive")}>
                      {formatGap(row.makespan, row.bestKnown)}
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState icon={<Database className="h-5 w-5" />} text="尚未运行基准数据集" />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Makespan柱状对比</CardTitle>
        </CardHeader>
        <CardContent className="h-[340px]">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                <Legend />
                <Bar dataKey="本次Makespan" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="最优已知值" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={<Activity className="h-5 w-5" />} text="运行数据集后显示柱状图" />
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function AgentsTab({
  traces,
  rewardHistory,
  topologyPie,
  experiment,
  loading,
  runningA2c,
  onRunA2c,
}: {
  traces: Trace[];
  rewardHistory: { episode?: number; reward?: number; topology?: string }[];
  topologyPie: { name: string; value: number }[];
  experiment: ExperimentPayload;
  loading: boolean;
  runningA2c: boolean;
  onRunA2c: () => void;
}) {
  const series = Array.from(new Set(rewardHistory.map((row) => row.topology || "unknown")));
  const chartRows = rewardHistory.map((row) => ({
    episode: row.episode,
    [row.topology || "unknown"]: row.reward,
  }));
  const baselines = baselineRows(experiment);
  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>ReflAct决策链</CardTitle>
          <CardDescription>
            本次调度共调用 {traces.length} 个智能体协作完成决策。每个智能体通过ReflAct框架独立推理：先反射当前工厂状态与生产目标的偏差，再输出建议动作。以下展示每个智能体的完整推理过程。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <SkeletonRows />
          ) : traces.length ? (
            <div className="grid gap-3">
              {traces.map((trace, index) => <TraceCard trace={trace} key={`${trace.agent_name}-${index}`} />)}
            </div>
          ) : (
            <EmptyState icon={<Bot className="h-5 w-5" />} text="暂无智能体决策数据" />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>A2C训练曲线</CardTitle>
              <CardDescription>不同颜色代表不同拓扑的奖励变化。</CardDescription>
            </div>
            <Button onClick={onRunA2c} disabled={runningA2c}>
              {runningA2c ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {runningA2c ? "训练中..." : "运行A2C训练"}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              {rewardHistory.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartRows}>
                    <CartesianGrid stroke="hsl(var(--border))" />
                    <XAxis dataKey="episode" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                    <Legend verticalAlign="bottom" />
                    {series.map((topology, index) => (
                      <Line
                        key={topology}
                        type="monotone"
                        dataKey={topology}
                        name={topologyLabel[topology] ?? topology}
                        stroke={TOPOLOGY_COLORS[index % TOPOLOGY_COLORS.length]}
                        strokeWidth={3}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={<Activity className="h-5 w-5" />} text="运行A2C训练后显示奖励曲线" />
              )}
            </div>
            <Separator className="my-4" />
            <BaselineTable rows={baselines} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>拓扑选择占比</CardTitle>
            <CardDescription>优先展示A2C概率分布，缺省时使用本地运行历史统计。</CardDescription>
          </CardHeader>
          <CardContent className="h-[430px]">
            {topologyPie.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={topologyPie} dataKey="value" nameKey="name" outerRadius={120} label>
                    {topologyPie.map((entry, index) => (
                      <Cell key={entry.name} fill={TOPOLOGY_COLORS[index % TOPOLOGY_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={<Gauge className="h-5 w-5" />} text="暂无拓扑选择统计" />
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function MachineGrid({ machines }: { machines: Machine[] }) {
  if (!machines.length) return <EmptyState icon={<Factory className="h-5 w-5" />} text="暂无设备状态" />;
  return (
    <div className="grid max-h-[420px] grid-cols-2 gap-3 overflow-auto pr-1">
      {machines.map((machine) => {
        const failed = machine.status === "failed";
        const busy = machine.status === "busy";
        const available = machine.status === "available";
        return (
          <Card
            key={machine.id}
            className={cn(
              "p-3 transition-colors",
              failed && "border-destructive/60 bg-destructive/20",
              available && "border-emerald-500/30 bg-emerald-500/10",
              busy && "border-blue-500/30 bg-blue-500/10",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-sm font-bold">{failed && <AlertTriangle className="mr-1 inline h-4 w-4 text-destructive" />}{machine.id}</p>
                <h3 className="mt-1 font-medium">{machine.name}</h3>
              </div>
              <Badge className={machineBadgeClass(machine.status)} variant="outline">{machineStatusLabel[machine.status] ?? machine.status}</Badge>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>{machine.current_order_id ? `工单 ${machine.current_order_id}` : machine.capability ?? "待命"}</span>
              <span className={cn(machine.temperature_c > 90 && "animate-pulse text-destructive", machine.temperature_c > 85 && machine.temperature_c <= 90 && "text-amber-400")}>
                {Math.round(machine.temperature_c)}°C
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function OrderTable({ orders, urgentFlashKey }: { orders: Order[]; urgentFlashKey: number }) {
  if (!orders.length) return <EmptyState icon={<Activity className="h-5 w-5" />} text="暂无订单队列" />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>订单ID</TableHead>
          <TableHead>优先级</TableHead>
          <TableHead>截止时间</TableHead>
          <TableHead>工序数</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow
            className={cn(["urgent", "high"].includes(order.priority) && "border-l-2 border-l-destructive", order.id === "O_URGENT" && "urgent-row-flash")}
            key={`${order.id}-${urgentFlashKey}`}
          >
            <TableCell className="font-medium">{order.id}</TableCell>
            <TableCell><Badge className={priorityBadgeClass(order.priority)} variant="outline">{priorityLabel[order.priority] ?? order.priority}</Badge></TableCell>
            <TableCell>{minuteLabel(order.due_minute)}</TableCell>
            <TableCell>{order.operations.length}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function InventoryList({ inventory }: { inventory: InventoryItem[] }) {
  if (!inventory.length) return <EmptyState icon={<Database className="h-5 w-5" />} text="暂无库存数据" />;
  return (
    <div className="grid gap-2">
      {inventory.map((item, index) => {
        const name = item.name ?? item.material_id ?? item.id ?? `物料${index + 1}`;
        const quantity = item.quantity ?? item.available ?? 0;
        const required = item.required;
        return (
          <div key={`${name}-${index}`} className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
            <span>{name}</span>
            <strong>{quantity}{required !== undefined ? ` / ${required}` : ""} {item.unit ?? "pcs"}</strong>
          </div>
        );
      })}
    </div>
  );
}

function GanttChart({ items, makespan }: { items: ScheduleItem[]; makespan: number }) {
  if (!items.length) return <EmptyState icon={<Activity className="h-5 w-5" />} text="暂无排程结果" />;
  const visible = items.slice(0, Math.min(items.length, 350));
  const chartHeight = Math.max(200, Math.min(520, visible.length * 52 + 60));
  const machines = Array.from(new Set(items.map((item) => item.machine_id)));
  const colorByMachine = new Map(machines.map((machine, index) => [machine, MACHINE_COLORS[index % MACHINE_COLORS.length]]));
  const data = visible.map((item) => ({
    ...item,
    name: item.operation_id,
    offset: item.start_minute,
    duration: item.end_minute - item.start_minute,
  }));
  return (
    <div style={{height: chartHeight}}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data} margin={{ left: 50, right: 30, top: 8, bottom: 8 }}>
          <CartesianGrid stroke="hsl(var(--border))" />
          <XAxis type="number" domain={[0, Math.max(makespan, 1)]} stroke="hsl(var(--muted-foreground))" />
          <YAxis type="category" dataKey="name" width={120} stroke="hsl(var(--muted-foreground))" />
          <RechartsTooltip content={<GanttTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.18)" }} />
          <Bar dataKey="offset" stackId="time" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="duration" stackId="time" radius={[4, 4, 4, 4]}>
            {data.map((item) => <Cell key={item.operation_id} fill={colorByMachine.get(item.machine_id)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {items.length > visible.length && <p className="mt-2 text-xs text-muted-foreground">已完成 {items.length} 道工序排程，当前展示前 {visible.length} 道。</p>}
    </div>
  );
}

function GanttTooltip({ active, payload }: { active?: boolean; payload?: { payload: ScheduleItem & { duration: number; name: string } }[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-md border bg-card p-3 text-xs shadow-md">
      <p className="font-semibold text-foreground">工序ID：{item.operation_id}</p>
      <p className="text-muted-foreground">分配机器：{item.machine_id}</p>
      <p className="text-muted-foreground">开始时间：{item.start_minute} 分钟</p>
      <p className="text-muted-foreground">结束时间：{item.end_minute} 分钟</p>
      <p className="text-muted-foreground">加工时长：{item.duration} 分钟</p>
    </div>
  );
}

function MachineLegend({ items }: { items: ScheduleItem[] }) {
  const machines = Array.from(new Set(items.map((item) => item.machine_id)));
  if (!machines.length) return null;
  return (
    <div className="flex max-w-[520px] flex-wrap justify-end gap-2">
      {machines.map((machine, index) => (
        <span key={machine} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <i className="h-3 w-3 rounded-sm" style={{ background: MACHINE_COLORS[index % MACHINE_COLORS.length] }} />
          {machine}
        </span>
      ))}
    </div>
  );
}

function TraceCard({ trace }: { trace: Trace }) {
  const canonical = canonicalAgent(trace.agent_name);
  const confidence = confidencePercent(trace.decision.confidence);
  const confidenceTone = confidence < 60 ? "bg-destructive" : confidence < 80 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <Card className="grid grid-cols-[20fr_40fr_40fr] gap-3 p-3">
      <div className="space-y-3">
        <div>
          <h3 className="text-base font-semibold">{nodeLabel[canonical] ?? trace.agent_name.replace(/Agent$/, "")}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{agentRole[canonical] ?? "参与本次智能体协作并输出调度决策"}</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>风险置信度</span>
            <span>{confidence}%</span>
          </div>
          <Progress value={confidence} indicatorClassName={confidenceTone} />
        </div>
      </div>
      <div className="grid gap-3">
        <TranslatedField label="当前状态" original={sanitizeText(trace.decision.current_state)} translated={translateCurrentState(trace.decision.current_state)} />
        <TranslatedField label="偏差分析" original={sanitizeText(trace.decision.gap || trace.decision.evidence)} translated={translateText(trace.decision.gap || trace.decision.evidence)} />
      </div>
      <div className="grid gap-3">
        <TranslatedField label="目标" original={sanitizeText(trace.decision.goal)} translated={translateText(trace.decision.goal)} />
        <TranslatedField label="建议动作" original={sanitizeText(trace.decision.recommended_action)} translated={translateText(trace.decision.recommended_action)} highlight />
      </div>
    </Card>
  );
}

function TranslatedField({ label, original, translated, highlight = false }: { label: string; original: string; translated: string; highlight?: boolean }) {
  const [open, setOpen] = useState(false);
  const canExpand = hasEnglish(original) && original !== translated;
  return (
    <div className="rounded-md border bg-background p-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <p className={cn("mt-0.5 text-sm leading-snug", highlight ? "text-primary" : "text-foreground")}>{translated}</p>
      {canExpand && (
        <Button variant="link" size="sm" className="mt-0.5 h-auto p-0 text-xs" onClick={() => setOpen((value) => !value)}>
          {open ? "收起原文" : "查看原文"}
        </Button>
      )}
      {open && <code className="mt-1 block rounded-md border bg-card p-2 text-xs text-muted-foreground">{original}</code>}
    </div>
  );
}

function Metric({ label, value, tooltip, bumpKey }: { label: string; value: string; tooltip?: string; bumpKey: number }) {
  return (
    <div className="rounded-md border border-border bg-background/60 p-3 transition-all duration-300">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3.5 w-3.5 cursor-help" />
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </span>
      <strong key={bumpKey} className="number-bump mt-1 block text-lg font-bold text-foreground">{value}</strong>
    </div>
  );
}

function DatasetMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-background p-2">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function BaselineTable({ rows }: { rows: { name: string; description: string; reward: number }[] }) {
  if (!rows.length) return <EmptyState icon={<Activity className="h-5 w-5" />} text="暂无基线对比数据" />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>系统名称</TableHead>
          <TableHead>描述</TableHead>
          <TableHead>Reward</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const current = /A2C|ReflAct|当前/.test(row.name + row.description);
          return (
            <TableRow key={row.name} className={cn(current && "border-l-2 border-l-primary bg-primary/10")}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell className="text-muted-foreground">{row.description}</TableCell>
              <TableCell>{Number.isFinite(row.reward) ? row.reward.toFixed(2) : "-"}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function NotificationStack({ notices, onClose }: { notices: Notice[]; onClose: (id: string) => void }) {
  const colorClass: Record<NoticeType, string> = {
    success: "border-emerald-500/50 text-emerald-300",
    warning: "border-amber-500/50 text-amber-300",
    error: "border-destructive/60 text-destructive",
    info: "border-primary/50 text-primary",
  };
  const icon: Record<NoticeType, React.ReactNode> = {
    success: <CheckCircle2 className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
    error: <AlertTriangle className="h-4 w-4" />,
    info: <Server className="h-4 w-4" />,
  };
  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-[420px] flex-col gap-2">
      {notices.map((notice) => (
        <Alert key={notice.id} className={cn("overflow-hidden bg-card shadow-lg", colorClass[notice.type])}>
          <Button variant="ghost" size="icon" className="absolute right-1 top-1 h-7 w-7" onClick={() => onClose(notice.id)}>
            <X className="h-3.5 w-3.5" />
          </Button>
          <AlertDescription className="flex gap-2 pr-6 text-sm">
            {icon[notice.type]}
            <span>{notice.message}</span>
          </AlertDescription>
          <i className="notification-progress absolute bottom-0 left-0 h-0.5 bg-current" style={{ animationDuration: `${notice.durationMs}ms` }} />
        </Alert>
      ))}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="grid min-h-[120px] place-items-center rounded-md border border-dashed text-muted-foreground">
      <div className="flex items-center gap-2 text-sm">{icon}{text}</div>
    </div>
  );
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted", className)} />;
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 6 }).map((_, index) => <SkeletonLine className="h-[126px]" key={index} />)}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="grid gap-2">
      {Array.from({ length: 5 }).map((_, index) => <SkeletonLine className="h-9" key={index} />)}
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="grid grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, index) => <SkeletonLine className="h-[282px]" key={index} />)}
    </div>
  );
}

function machineBadgeClass(status: string) {
  if (status === "failed") return "border-destructive/30 bg-destructive/20 text-destructive";
  if (status === "busy") return "border-blue-500/30 bg-blue-500/20 text-blue-300";
  if (status === "available") return "border-emerald-500/30 bg-emerald-500/20 text-emerald-400";
  return "border-muted-foreground/30 bg-muted/30 text-muted-foreground";
}

function priorityBadgeClass(priority: string) {
  if (priority === "urgent") return "border-destructive/30 bg-destructive/20 text-destructive";
  if (priority === "high") return "border-amber-500/30 bg-amber-500/20 text-amber-300";
  return "border-muted-foreground/30 bg-muted/30 text-muted-foreground";
}

function buildFlow(
  topology: string,
  risk: string,
  actionByNode: Record<string, string>,
  activeNodes: Set<string>,
  activeEdges: Set<string>,
): { nodes: Node[]; edges: Edge[] } {
  const links = topologyEdges[topology] ?? topologyEdges.serial_chain;
  const names = Array.from(new Set(links.flat()));
  const riskBorder = risk === "high" || risk === "critical" ? "hsl(var(--destructive))" : risk === "medium" ? "#F4A261" : "hsl(var(--border))";
  const nodes = names.map((name, index) => {
    const action = actionByNode[name] || "等待执行";
    const label = nodeLabel[name] ?? name;
    const active = activeNodes.has(name);
    return {
      id: name,
      data: {
        plainLabel: label,
        label: (
          <div className="grid gap-0.5 text-center" title={action}>
            <strong className="text-sm font-semibold">{label}</strong>
            {action && action !== "等待执行" && (
              <span className="text-xs text-muted-foreground" style={{wordBreak:"break-all",whiteSpace:"normal",lineHeight:"1.2",maxHeight:"2.4em",overflow:"hidden"}}>
                {action.length > 18 ? `${action.slice(0, 18)}…` : action}
              </span>
            )}
          </div>
        ),
      },
      position: { x: (index % 3) * 210, y: Math.floor(index / 3) * 130 },
      className: active ? "node-pulse" : "",
      style: {
        width: 170,
        borderRadius: 6,
        border: `1px solid ${active ? "hsl(var(--primary))" : riskBorder}`,
        background: active ? "rgba(0, 180, 216, 0.20)" : "hsl(var(--card))",
        color: "hsl(var(--foreground))",
        boxShadow: active ? "0 0 0 8px rgba(0, 180, 216, 0.08), 0 0 22px rgba(0, 180, 216, 0.45)" : "none",
        padding: 10,
      },
    };
  });
  const edges = links.map(([source, target]) => {
    const id = `${source}-${target}`;
    const active = activeEdges.has(id);
    return {
      id,
      source,
      target,
      type: "straight",
      animated: active,
      markerEnd: { type: MarkerType.ArrowClosed, color: active ? "hsl(var(--primary))" : "hsl(var(--border))" },
      style: { stroke: active ? "hsl(var(--primary))" : "hsl(var(--border))", strokeWidth: active ? 3 : 2 },
      className: active ? "flow-edge-active" : "",
    };
  });
  return { nodes, edges };
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
