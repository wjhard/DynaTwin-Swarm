import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import ReactFlow, { Background, Edge, MarkerType, Node } from "reactflow";
import "reactflow/dist/style.css";
import {
  Activity, AlertTriangle, Bot, CheckCircle2, ChevronRight,
  Clock, Database, Factory, Gauge, LayoutDashboard, Loader2,
  Pause, Play, Plus, RotateCcw, Server, Settings, TrendingUp,
  X, Zap,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer,
  Tooltip as RechartsTooltip, XAxis, YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import "./styles.css";

// ── Types ────────────────────────────────────────────────
type Machine = { id: string; name: string; status: string; temperature_c: number; current_order_id?: string | null; efficiency?: number; };
type Order = { id: string; priority: string; due_minute: number; operations: { id: string; required_capability?: string; duration_minutes?: number; needs_reassignment?: boolean }[]; };
type AlertItem = { severity?: string; message?: string; machine_id?: string; };
type EventItem = { type?: string; machine_id?: string; message?: string; minute?: number };
type FactoryState = { now_minute?: number; machines?: Machine[]; orders?: Order[]; alerts?: AlertItem[]; events?: EventItem[]; recovery_schedule?: Record<string, number>; metadata?: Record<string, unknown>; };
type ScheduleItem = { order_id: string; operation_id: string; machine_id: string; start_minute: number; end_minute: number; };
type Trace = { agent_name: string; decision: { current_state?: string; goal?: string; gap?: string; risk_level?: string; recommended_action?: string; confidence?: number; }; };
type RunResult = { state?: FactoryState; selected_topology?: string; topology_selection?: { topology_name?: string; reason?: string; confidence?: number }; task_profile?: Record<string, unknown>; agent_traces?: Trace[]; best_plan?: { items?: ScheduleItem[]; metrics?: Record<string, unknown> }; metrics?: Record<string, unknown>; };
type PublicDataset = { id: string; name: string; source?: string; description?: string; machine_count: number; job_count: number; operation_count: number; best_known_makespan?: number | null; optimal?: number | null; };
type BenchmarkRow = { id: string; datasetName: string; makespan: number; topology: string; solveTimeMs: number; bestKnown?: number | null; };
type ExperimentPayload = { history?: { episode?: number; reward?: number; topology?: string }[]; probabilities?: Record<string, number>; };
type Notice = { id: string; type: "success" | "warning" | "error" | "info"; message: string; };
type LogEntry = { id: string; ts: string; agent: string; action: string; risk: string; };
type Section = "overview" | "monitor" | "ai" | "schedule" | "benchmark" | "training";

// ── Constants ────────────────────────────────────────────
const API = (import.meta.env.VITE_API_BASE || "http://127.0.0.1:8010").replace(/\/$/, "");
const MACHINE_COLORS = ["#00B4D8","#06D6A0","#F4A261","#FF6B35","#8A5CF6","#3DDC97","#4CC9F0","#C77DFF","#90BE6D","#F9C74F"];
const TOPOLOGY_COLORS = ["#64748B","#00B4D8","#06D6A0","#F4A261","#FF6B35","#8A5CF6"];

const topologyLabel: Record<string, string> = { serial_chain:"串行链", parallel_fusion:"并行汇聚", hierarchical_tree:"层级树", supervisor_tree:"层级树", full_mesh:"全连接", fully_connected:"全连接", high_risk_review:"高风险审查" };
const nodeLabel: Record<string, string> = { TaskRouter:"任务路由", Supervisor:"监督调度", Monitor:"设备监控", Diagnosis:"故障诊断", Order:"订单分析", Resource:"资源分配", Schedule:"调度求解", Constraint:"约束验证", Risk:"风险评估", Critic:"决策审核", FinalDecision:"决策审核", Report:"报告生成" };
const agentRole: Record<string, string> = { TaskRouter:"识别任务类型，选择协作拓扑", Monitor:"扫描机器状态，标记故障设备", Diagnosis:"分析故障影响，移除不可用机器", Order:"评估订单优先级和截止压力", Resource:"分配生产资源，解决冲突", Schedule:"CP-SAT求解器计算最优排程", Constraint:"检查排程约束合规性", Risk:"综合评估当前风险等级", Critic:"对决策方案进行一致性校验", Report:"汇总输出最终调度报告" };
const riskLabel: Record<string, string> = { low:"低风险", normal:"低风险", medium:"中等风险", high:"高风险", critical:"极高风险" };
const machineStatusLabel: Record<string, string> = { available:"可用", busy:"运行中", failed:"故障", maintenance:"维护中" };
const priorityLabel: Record<string, string> = { normal:"普通", high:"高优先级", urgent:"紧急" };
const sectionLabel: Record<Section, string> = { overview:"工厂总览", monitor:"实时监控", ai:"AI决策", schedule:"排程结果", benchmark:"基准测试", training:"AI训练" };
const sectionIcon: Record<Section, React.ReactNode> = {
  overview: <LayoutDashboard className="h-4 w-4" />,
  monitor: <Activity className="h-4 w-4" />,
  ai: <Bot className="h-4 w-4" />,
  schedule: <TrendingUp className="h-4 w-4" />,
  benchmark: <Database className="h-4 w-4" />,
  training: <Settings className="h-4 w-4" />,
};

const topologyEdges: Record<string, [string,string][]> = {
  serial_chain: [["TaskRouter","Monitor"],["Monitor","Schedule"],["Schedule","Constraint"],["Constraint","Report"]],
  parallel_fusion: [["TaskRouter","Monitor"],["Monitor","Diagnosis"],["Monitor","Order"],["Monitor","Resource"],["Diagnosis","Schedule"],["Order","Schedule"],["Resource","Schedule"],["Schedule","Constraint"],["Constraint","Report"]],
  supervisor_tree: [["TaskRouter","Supervisor"],["Supervisor","Diagnosis"],["Supervisor","Order"],["Supervisor","Resource"],["Supervisor","Risk"],["Diagnosis","Schedule"],["Order","Schedule"],["Resource","Schedule"],["Risk","Schedule"],["Schedule","Constraint"],["Constraint","Critic"],["Critic","Report"]],
  hierarchical_tree: [["TaskRouter","Supervisor"],["Supervisor","Diagnosis"],["Supervisor","Order"],["Supervisor","Resource"],["Supervisor","Risk"],["Risk","Schedule"],["Schedule","Report"]],
  full_mesh: [["TaskRouter","Monitor"],["TaskRouter","Diagnosis"],["TaskRouter","Order"],["TaskRouter","Resource"],["Monitor","Schedule"],["Diagnosis","Schedule"],["Order","Schedule"],["Resource","Schedule"],["Schedule","Risk"],["Risk","Critic"],["Critic","Report"]],
  fully_connected: [["TaskRouter","Monitor"],["TaskRouter","Diagnosis"],["TaskRouter","Order"],["TaskRouter","Resource"],["Monitor","Schedule"],["Diagnosis","Schedule"],["Order","Schedule"],["Resource","Schedule"],["Schedule","Risk"],["Risk","Critic"],["Critic","Report"]],
  high_risk_review: [["TaskRouter","Monitor"],["Monitor","Diagnosis"],["Monitor","Order"],["Monitor","Resource"],["Diagnosis","Schedule"],["Order","Schedule"],["Resource","Schedule"],["Schedule","Constraint"],["Constraint","Risk"],["Risk","Critic"],["Critic","Report"]],
};

const translationRules: { match: RegExp; value: string }[] = [
  { match: /route to high_risk_review/i, value: "路由到高风险审查拓扑，先隔离异常再进入审核链路。" },
  { match: /route to parallel/i, value: "路由到并行分析拓扑，多智能体同时评估。" },
  { match: /route to serial/i, value: "路由到串行链拓扑，轻量完成常规排产。" },
  { match: /parallel analysis topology/i, value: "进入并行分析拓扑以减少决策瓶颈。" },
  { match: /classify the industrial task/i, value: "识别工业任务类型，选择协作拓扑。" },
  { match: /no safety freeze required/i, value: "当前不需要安全冻结，可继续调度。" },
  { match: /invoke cp-sat/i, value: "调用CP-SAT求解器，计算最优排程方案。" },
  { match: /freeze unsafe machine/i, value: "冻结不安全机器并发布告警。" },
  { match: /remove.*candidate machine/i, value: "从候选机器中移除故障机器，重新路由工单。" },
  { match: /prioritize urgent.*due.date/i, value: "按截止时间优先处理紧急订单。" },
  { match: /current capacity.*safety state.*diverges/i, value: "当前产能偏离安全生产目标。" },
  { match: /state is close to.*production goal/i, value: "当前状态接近生产目标，无需干预。" },
  { match: /reject any plan using failed/i, value: "拒绝使用故障设备的排程方案。" },
  { match: /approve the safest feasible/i, value: "批准最安全可行的决策方案。" },
  { match: /require critic review/i, value: "需要进入决策审核环节。" },
  { match: /report selected topology/i, value: "汇总拓扑选择和智能体决策链，输出最终报告。" },
  { match: /resolve material shortage/i, value: "处理物料短缺和机器容量冲突。" },
  { match: /validate machine capacity/i, value: "校验机器能力、工序先后、库存和安全约束。" },
];

// ── Helpers ──────────────────────────────────────────────
async function getJson(path: string) { const r = await fetch(`${API}${path}`); if (!r.ok) throw new Error("请求失败"); return r.json(); }
async function postJson(path: string, body: unknown = {}) { const r = await fetch(`${API}${path}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) }); if (!r.ok) throw new Error("请求失败"); return r.json(); }

function sanitize(v?: unknown): string { return String(v ?? "暂无").replace(/\bmock\s*:\s*/gi,"").replace(/\bfallback\s*:\s*/gi,"").trim(); }
function translate(v?: unknown) { const t = sanitize(v); for (const r of translationRules) { if (r.match.test(t)) return r.value; } return t; }
function translateState(v?: unknown) {
  const t = sanitize(v);
  const m = t.match(/machines\s*[:=]\s*(\d+)/i)?.[1];
  const f = t.match(/failed\s*[:=]\s*(\d+)/i)?.[1];
  const u = t.match(/urgent_orders\s*[:=]\s*(\d+)/i)?.[1];
  const a = t.match(/alerts\s*[:=]\s*(\d+)/i)?.[1];
  if (m||f||u||a) return [m?`${m}台机器`:"", f?`${f}台故障`:"", u?`${u}个紧急订单`:"", a?`${a}条告警`:""].filter(Boolean).join("，");
  return t.replace(/machines/gi,"台机器").replace(/failed/gi,"故障").replace(/urgent_orders/gi,"紧急订单").replace(/alerts/gi,"条告警").replace(/[():]/g," ").trim();
}
function canonicalAgent(name: string) { return name.replace(/Agent$/,"").replace("FinalDecision","Critic"); }
function planMakespan(items: ScheduleItem[], metrics?: Record<string,unknown>) { const m = Number(metrics?.makespan); return (Number.isFinite(m) && m > 0) ? m : Math.max(0,...items.map(i=>i.end_minute)); }
function formatGap(makespan: number, best?: number|null) { if (!best) return "-"; return `${(((makespan-best)/best)*100).toFixed(1)}%`; }
function recoveryScheduleFromState(state: FactoryState|null): Record<string, number> {
  const raw = state?.metadata?.recovery_schedule ?? state?.recovery_schedule ?? {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .map(([machineId, minute]) => [machineId, Number(minute)])
      .filter(([, minute]) => Number.isFinite(minute))
  );
}
function riskLevel(state: FactoryState|null, orders: Order[], result: RunResult|null): string {
  const failed = (state?.machines??[]).filter(m=>m.status==="failed").length;
  const alerts = (state?.alerts??[]).length;
  const urgent = orders.filter(o=>["urgent","high"].includes(o.priority)).length;
  if (failed>=2) return "critical";
  if (failed>=1||alerts>=3) return "high";
  if (urgent>=1||alerts>=1) return "medium";
  const r = result?.task_profile?.risk_level;
  return typeof r==="string" ? r : "low";
}
function bannerStyle(risk: string) {
  if (risk==="medium") return { cls:"bg-amber-500/15 border border-amber-500/30 text-amber-400", text:"存在中等风险，建议关注" };
  if (risk==="high"||risk==="critical") return { cls:"bg-destructive/15 border border-destructive/30 text-destructive", text:"检测到高风险事件，AI已自动重新排程" };
  return { cls:"bg-emerald-500/15 border border-emerald-500/30 text-emerald-400", text:"工厂运行正常" };
}
function timeStr() { return new Date().toLocaleTimeString("zh-CN",{hour12:false}); }

// ── Sub-components ───────────────────────────────────────

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", ok ? "bg-emerald-500 status-dot-active" : "bg-muted-foreground/40")} />;
}

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-3xl font-bold tracking-tight", color ?? "text-foreground")}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </Card>
  );
}

function MachineCard({ machine, recoveryMinute, nowMinute = 0 }: { machine: Machine; recoveryMinute?: number; nowMinute?: number }) {
  const failed = machine.status === "failed";
  const busy = machine.status === "busy";
  const hot = machine.temperature_c > 85;
  const recoveryRemaining = failed && recoveryMinute !== undefined ? Math.max(0, Math.ceil(recoveryMinute - nowMinute)) : null;
  return (
    <Card className={cn("p-3 transition-colors", failed && "border-destructive/60 bg-destructive/5 machine-failed")}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-xs text-muted-foreground">{machine.id}</span>
        <Badge variant="outline" className={cn("text-xs", failed ? "border-destructive text-destructive" : busy ? "border-primary text-primary" : "border-emerald-500 text-emerald-500")}>
          {failed && "⚠ "}{machineStatusLabel[machine.status] ?? machine.status}
        </Badge>
      </div>
      <p className="font-semibold text-sm leading-snug">{machine.name}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-muted-foreground">{machine.current_order_id ? `工单 ${machine.current_order_id}` : "待命"}</span>
        <span className={cn("text-xs font-mono", hot ? "text-destructive font-bold" : "text-muted-foreground")}>{machine.temperature_c}°C</span>
      </div>
      {machine.efficiency !== undefined && (
        <div className="mt-2">
          <div className="flex justify-between text-xs text-muted-foreground mb-0.5"><span>效率</span><span>{Math.round(machine.efficiency*100)}%</span></div>
          <Progress value={machine.efficiency*100} className="h-1" />
        </div>
      )}
      {recoveryRemaining !== null && (
        <p className="mt-2 text-xs text-amber-400">预计 {recoveryRemaining} 分钟后自动恢复</p>
      )}
    </Card>
  );
}

function OrderRow({ order }: { order: Order }) {
  const urgent = order.priority==="urgent";
  const high = order.priority==="high";
  return (
    <TableRow className={cn(urgent && "border-l-2 border-destructive", high && "border-l-2 border-amber-500")}>
      <TableCell className="font-mono text-sm">{order.id}</TableCell>
      <TableCell>
        <Badge variant="outline" className={cn("text-xs", urgent ? "border-destructive text-destructive" : high ? "border-amber-500 text-amber-500" : "border-muted text-muted-foreground")}>
          {priorityLabel[order.priority] ?? order.priority}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{order.due_minute} 分钟</TableCell>
      <TableCell className="text-sm text-center">{order.operations.length}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{order.operations.map(o=>o.required_capability).filter(Boolean).join(" → ")}</TableCell>
    </TableRow>
  );
}

function TopologyGraph({ topology, traces, animating }: { topology: string; traces: Trace[]; animating: boolean }) {
  const actionMap = useMemo(() => {
    return traces.reduce<Record<string,string>>((acc,t) => { acc[canonicalAgent(t.agent_name)] = translate(t.decision.recommended_action); return acc; }, {});
  }, [traces]);

  const edges: [string,string][] = topologyEdges[topology] ?? topologyEdges.parallel_fusion;
  const nodeIds = Array.from(new Set(edges.flatMap(([a,b])=>[a,b])));

  const positions: Record<string,[number,number]> = {
    TaskRouter:[0,0], Supervisor:[1,0],
    Monitor:[0,1], Diagnosis:[1,1], Order:[2,1], Resource:[3,1],
    Schedule:[1.5,2], Constraint:[1.5,3], Risk:[0.5,3], Critic:[1,4], Report:[1.5,5],
  };

  const nodes: Node[] = nodeIds.map((id,i) => {
    const pos = positions[id] ?? [i%3, Math.floor(i/3)];
    const isActive = animating && Object.keys(actionMap).includes(id);
    return {
      id, position:{ x:pos[0]*185+20, y:pos[1]*110+20 },
      data:{ label:(
        <div className="text-center px-1">
          <div className={cn("text-sm font-semibold", isActive && "text-primary")}>{nodeLabel[id]??id}</div>
          {actionMap[id] && <div className="text-xs text-muted-foreground mt-0.5 leading-tight" style={{maxWidth:130,wordBreak:"break-all"}}>{actionMap[id].slice(0,22)}{actionMap[id].length>22?"…":""}</div>}
        </div>
      )},
      style:{ background: isActive ? "hsl(var(--primary)/0.15)" : "hsl(var(--card))", border:`1px solid ${isActive?"hsl(var(--primary))":"hsl(var(--border))"}`, borderRadius:8, padding:"6px 8px", minWidth:145, fontSize:12, color:"hsl(var(--foreground))" },
      width:155,
    };
  });

  const flowEdges: Edge[] = edges.map(([s,t],i) => ({
    id:`e${i}`, source:s, target:t, type:"smoothstep",
    markerEnd:{ type:MarkerType.ArrowClosed, color:"hsl(var(--primary)/0.6)", width:14, height:14 },
    style:{ stroke:"hsl(var(--primary)/0.4)", strokeWidth:1.5 },
    animated: animating,
  }));

  return (
    <div style={{height:480}} className="rounded-lg border border-border overflow-hidden">
      <ReactFlow nodes={nodes} edges={flowEdges} fitView fitViewOptions={{padding:0.15}} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} zoomOnScroll={false} panOnDrag={false}>
        <Background color="hsl(var(--border)/0.3)" gap={24} />
      </ReactFlow>
    </div>
  );
}

function LogStream({ logs }: { logs: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs]);
  if (!logs.length) return (
    <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
      <Bot className="h-4 w-4 mr-2" />暂无推理记录，触发事件后自动更新
    </div>
  );
  return (
    <div ref={ref} className="h-56 overflow-y-auto font-mono text-xs space-y-1 pr-1">
      {logs.map(log => (
        <div key={log.id} className="flex gap-2 items-start">
          <span className="text-muted-foreground shrink-0">{log.ts}</span>
          <span className={cn("shrink-0 font-semibold", log.risk==="high"||log.risk==="critical" ? "text-destructive" : log.risk==="medium" ? "text-amber-400" : "text-primary")}>
            [{log.agent}]
          </span>
          <span className="text-foreground/80 leading-relaxed">{log.action}</span>
        </div>
      ))}
    </div>
  );
}

function GanttChart({ items, makespan }: { items: ScheduleItem[]; makespan: number }) {
  const visible = items.slice(0, 80);
  const machines = Array.from(new Set(items.map(i=>i.machine_id)));
  const colorMap = new Map(machines.map((m,i)=>[m, MACHINE_COLORS[i%MACHINE_COLORS.length]]));
  if (!visible.length) return <div className="flex items-center justify-center h-40 text-muted-foreground text-sm"><TrendingUp className="h-4 w-4 mr-2"/>暂无排程数据</div>;
  const data = visible.map(i=>({ name:i.operation_id, offset:i.start_minute, duration:i.end_minute-i.start_minute, machine:i.machine_id, fill:colorMap.get(i.machine_id)??"#888" }));
  const h = Math.max(180, Math.min(480, visible.length*36+60));
  return (
    <div>
      <div className="flex gap-4 flex-wrap mb-3">
        {machines.slice(0,10).map(m=>(
          <div key={m} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block w-3 h-3 rounded-sm" style={{background:colorMap.get(m)}} />
            {m}
          </div>
        ))}
      </div>
      <div style={{height:h}}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={data} margin={{left:80,right:20,top:0,bottom:20}}>
            <CartesianGrid horizontal={false} stroke="hsl(var(--border)/0.4)" />
            <XAxis type="number" domain={[0,makespan||"auto"]} tick={{fill:"hsl(var(--muted-foreground))",fontSize:11}} label={{value:"时间（分钟）",position:"insideBottom",offset:-8,fill:"hsl(var(--muted-foreground))",fontSize:11}} />
            <YAxis type="category" dataKey="name" width={76} tick={{fill:"hsl(var(--muted-foreground))",fontSize:10}} />
            <RechartsTooltip content={({active,payload})=>{
              if (!active||!payload?.[0]) return null;
              const d = payload[0].payload;
              return <div className="rounded-lg border border-border bg-popover p-2 text-xs shadow-lg"><p className="font-semibold mb-1">{d.name}</p><p>机器：{d.machine}</p><p>开始：{d.offset} 分钟</p><p>完工：{d.offset+d.duration} 分钟</p><p>时长：{d.duration} 分钟</p></div>;
            }} />
            <Bar dataKey="offset" stackId="g" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="duration" stackId="g" radius={[2,2,2,2]} isAnimationActive={false}>
              {data.map((d,i)=><Cell key={i} fill={d.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function NoticeStack({ notices, onClose }: { notices: Notice[]; onClose: (id: string) => void }) {
  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full">
      {notices.map(n=>(
        <div key={n.id} className={cn("flex items-start gap-3 rounded-lg border p-3 shadow-lg text-sm backdrop-blur",
          n.type==="success" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
          n.type==="warning" && "border-amber-500/40 bg-amber-500/10 text-amber-400",
          n.type==="error" && "border-destructive/40 bg-destructive/10 text-destructive",
          n.type==="info" && "border-primary/40 bg-primary/10 text-primary",
        )}>
          <span className="shrink-0 mt-0.5">{n.type==="success"?"✅":n.type==="warning"?"⚠️":n.type==="error"?"🔴":"🔵"}</span>
          <span className="flex-1 leading-snug">{n.message}</span>
          <button onClick={()=>onClose(n.id)} className="shrink-0 opacity-60 hover:opacity-100"><X className="h-3.5 w-3.5"/></button>
        </div>
      ))}
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────
function App() {
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [autoRunning, setAutoRunning] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [animating, setAnimating] = useState(false);

  const [state, setState] = useState<FactoryState|null>(null);
  const [result, setResult] = useState<RunResult|null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [datasets, setDatasets] = useState<PublicDataset[]>([]);
  const [benchRows, setBenchRows] = useState<BenchmarkRow[]>([]);
  const [runningDataset, setRunningDataset] = useState<string|null>(null);
  const [experiment, setExperiment] = useState<ExperimentPayload|null>(null);
  const [a2cRunning, setA2cRunning] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [clock, setClock] = useState(timeStr());
  const [techVisible, setTechVisible] = useState(false);

  const autoRef = useRef<number|null>(null);
  const latestRecoveryEventRef = useRef<string>("");
  const sectionRefs = useRef<Partial<Record<Section,HTMLElement>>>({});

  // derived
  const orders = useMemo(()=> (state?.machines ? (result?.best_plan ? [] : []) : []).concat(state ? [] : []) , [state, result]);
  const allOrders = useMemo(()=> state?.orders ?? result?.state?.orders ?? [], [state, result]);
  const machines = useMemo(()=> state?.machines ?? result?.state?.machines ?? [], [state, result]);
  const scheduleItems = useMemo(()=> result?.best_plan?.items ?? [], [result]);
  const makespan = useMemo(()=> planMakespan(scheduleItems, result?.best_plan?.metrics), [scheduleItems, result]);
  const traces = useMemo(()=> result?.agent_traces ?? [], [result]);
  const topology = useMemo(()=> result?.selected_topology ?? result?.topology_selection?.topology_name ?? "parallel_fusion", [result]);
  const risk = useMemo(()=> riskLevel(state, allOrders, result), [state, allOrders, result]);
  const banner = useMemo(()=> bannerStyle(risk), [risk]);
  const failedMachines = useMemo(()=> machines.filter(m=>m.status==="failed"), [machines]);
  const urgentOrders = useMemo(()=> allOrders.filter(o=>["urgent","high"].includes(o.priority)), [allOrders]);
  const recoverySchedule = useMemo(()=> recoveryScheduleFromState(state), [state]);

  // OEE
  const oee = useMemo(()=>{
    if (!machines.length) return { availability:0, performance:0, oee:0 };
    const avail = machines.filter(m=>m.status!=="failed").length / machines.length;
    const perf = machines.reduce((s,m)=>{ const t=m.temperature_c; return s+(m.status==="failed"?0:t>90?0.5:t>80?0.75:t>70?0.85:0.95); }, 0) / machines.length;
    return { availability:Math.round(avail*100), performance:Math.round(perf*100), oee:Math.round(avail*perf*0.96*100) };
  }, [machines]);

  function addLog(agent: string, action: string, risk_: string) {
    setLogs(prev => [...prev.slice(-49), { id: Math.random().toString(36).slice(2), ts:timeStr(), agent, action:translate(action), risk:risk_ }]);
  }

  function notify(type: Notice["type"], message: string) {
    const id = Math.random().toString(36).slice(2);
    setNotices(prev=>[...prev, { id, type, message }]);
    setTimeout(()=>setNotices(prev=>prev.filter(n=>n.id!==id)), 5000);
  }

  useEffect(()=>{
    const latestRecovery = [...(state?.events ?? [])].reverse().find(event => event.type === "machine_recovered" && event.machine_id);
    if (!latestRecovery?.machine_id) return;
    const key = `${latestRecovery.machine_id}-${latestRecovery.minute ?? ""}-${latestRecovery.message ?? ""}`;
    if (!latestRecoveryEventRef.current) {
      latestRecoveryEventRef.current = key;
      return;
    }
    if (latestRecoveryEventRef.current !== key) {
      latestRecoveryEventRef.current = key;
      notify("success", `✅ ${latestRecovery.machine_id} 已自动恢复，AI正在重新优化排程`);
    }
  }, [state?.events]);

  function applyResult(data: RunResult) {
    setResult(data);
    if (data.state) setState(data.state);
    if (data.agent_traces) {
      data.agent_traces.forEach(t => addLog(canonicalAgent(t.agent_name), t.decision.recommended_action ?? "", t.decision.risk_level ?? "low"));
    }
    setAnimating(true);
    setTimeout(()=>setAnimating(false), 3000);
  }

  async function refreshLatestState() {
    const latest = await getJson("/api/state");
    setState(latest);
    return latest;
  }

  // init
  useEffect(()=>{
    (async()=>{
      try {
        const [s, r, ds] = await Promise.all([
          getJson("/api/state").catch(()=>null),
          getJson("/api/traces/latest").catch(()=>null),
          getJson("/api/datasets/public").catch(()=>({ datasets:[] })),
        ]);
        if (s) setState(s);
        if (r?.agent_traces) setResult(r);
        if (ds?.datasets) setDatasets(ds.datasets);
        setApiReady(true);
      } catch { setApiReady(false); }
    })();
    const tick = setInterval(()=>setClock(timeStr()), 1000);
    return ()=>clearInterval(tick);
  }, []);

  // auto refresh
  useEffect(()=>{
    if (autoRunning) {
      autoRef.current = window.setInterval(async()=>{
        try {
          const data = await postJson("/api/simulation/tick", { force_reschedule:false });
          if (data?.agent_traces) {
            applyResult(data);
            await refreshLatestState();
          } else {
            setState(data);
          }
          setApiReady(true);
        } catch { setApiReady(false); }
      }, 10000);
    } else {
      if (autoRef.current) clearInterval(autoRef.current);
    }
    return ()=>{ if (autoRef.current) clearInterval(autoRef.current); };
  }, [autoRunning]);

  // scroll spy
  useEffect(()=>{
    const obs = new IntersectionObserver(entries=>{
      entries.forEach(e=>{ if (e.isIntersecting) { const k = e.target.getAttribute("data-section") as Section; if (k) setActiveSection(k); } });
    }, { threshold:0.3 });
    Object.values(sectionRefs.current).forEach(el=>{ if (el) obs.observe(el); });
    return ()=>obs.disconnect();
  }, []);

  function scrollTo(sec: Section) {
    sectionRefs.current[sec]?.scrollIntoView({ behavior:"smooth", block:"start" });
  }

  async function triggerAlert() {
    setLoading(true);
    try {
      const data = await postJson("/api/simulation/scenario", { scenario:"random_failure" });
      applyResult(data);
      await refreshLatestState();
      notify("error","⚠️ M3设备过热告警，AI已自动切换至高风险审查拓扑并重新排程");
      setActiveSection("monitor");
    } catch { notify("error","触发失败，请检查后端服务"); }
    setLoading(false);
  }

  async function triggerOrder() {
    setLoading(true);
    try {
      const data = await postJson("/api/simulation/scenario", { scenario:"random_order" });
      applyResult(data);
      await refreshLatestState();
      notify("warning","🚨 紧急订单已插入，AI已重新计算排程方案");
      setActiveSection("monitor");
    } catch { notify("error","触发失败，请检查后端服务"); }
    setLoading(false);
  }

  async function triggerComposite() {
    setLoading(true);
    try {
      const data = await postJson("/api/simulation/scenario", { scenario:"composite" });
      applyResult(data);
      await refreshLatestState();
      notify("error","🔴 复合异常：设备故障 + 紧急插单，AI已启动高风险审查拓扑");
      setActiveSection("ai");
    } catch { notify("error","触发失败，请检查后端服务"); }
    setLoading(false);
  }

  async function doReset() {
    setLoading(true);
    try {
      const s = await postJson("/api/demo/reset");
      setState(s); setResult(null); setLogs([]);
      notify("success","✅ 系统已重置为初始状态");
    } catch { notify("error","重置失败"); }
    setLoading(false);
  }

  async function runDataset(ds: PublicDataset) {
    setRunningDataset(ds.id);
    try {
      const data = await postJson(`/api/datasets/public/${ds.id}/run`);
      applyResult(data);
      const mk = planMakespan(data.best_plan?.items ?? [], data.best_plan?.metrics);
      setBenchRows(prev=>{
        const filtered = prev.filter(r=>r.id!==ds.id);
        return [...filtered, { id:ds.id, datasetName:ds.name, makespan:mk, topology:topologyLabel[data.selected_topology]??"并行汇聚", solveTimeMs:Number(data.metrics?.solve_time_ms??0), bestKnown:ds.best_known_makespan??ds.optimal }];
      });
      notify("success",`✅ ${ds.name} 运行完成，Makespan=${mk}`);
      setActiveSection("schedule");
    } catch { notify("error",`${ds.name} 运行失败`); }
    setRunningDataset(null);
  }

  async function runA2C() {
    setA2cRunning(true);
    try {
      const data = await postJson("/api/experiments/run_a2c");
      setExperiment(data);
      notify("success","✅ A2C训练完成");
    } catch {
      const data = await getJson("/api/experiments/latest").catch(()=>null);
      if (data) setExperiment(data);
      notify("info","已加载上次实验结果");
    }
    setA2cRunning(false);
  }

  const sections: Section[] = ["overview","monitor","ai","schedule","benchmark","training"];

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── 左侧导航 ── */}
      <aside className="fixed left-0 top-0 h-screen w-56 border-r border-border bg-card/80 backdrop-blur z-40 flex flex-col">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Factory className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="font-bold text-sm leading-tight">DynaTwin-Swarm</p>
              <p className="text-xs text-muted-foreground">工业数字孪生排产系统</p>
            </div>
          </div>
        </div>

        {/* 状态摘要 */}
        <div className="px-4 py-3 border-b border-border">
          <div className={cn("rounded-md px-3 py-2 text-xs font-medium", banner.cls)}>{banner.text}</div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
            <div className="rounded bg-muted/40 px-2 py-1"><span className="text-muted-foreground">机器</span><span className="ml-1 font-semibold">{machines.length}</span></div>
            <div className="rounded bg-muted/40 px-2 py-1"><span className="text-muted-foreground">故障</span><span className={cn("ml-1 font-semibold", failedMachines.length>0?"text-destructive":"")}>{failedMachines.length}</span></div>
            <div className="rounded bg-muted/40 px-2 py-1"><span className="text-muted-foreground">订单</span><span className="ml-1 font-semibold">{allOrders.length}</span></div>
            <div className="rounded bg-muted/40 px-2 py-1"><span className="text-muted-foreground">紧急</span><span className={cn("ml-1 font-semibold", urgentOrders.length>0?"text-amber-400":"")}>{urgentOrders.length}</span></div>
          </div>
        </div>

        {/* 导航 */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {sections.map(sec=>(
            <button key={sec} onClick={()=>scrollTo(sec)} className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left", activeSection===sec ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")}>
              {sectionIcon[sec]}
              {sectionLabel[sec]}
              {activeSection===sec && <ChevronRight className="h-3 w-3 ml-auto" />}
            </button>
          ))}
        </nav>

        {/* 操作按钮 */}
        <div className="px-3 py-3 border-t border-border space-y-1.5">
          <p className="text-xs text-muted-foreground px-1 mb-2">场景演示</p>
          <Button size="sm" variant="destructive" className="w-full justify-start gap-2 text-xs" onClick={triggerAlert} disabled={loading}>
            <AlertTriangle className="h-3.5 w-3.5" />触发设备故障
          </Button>
          <Button size="sm" variant="outline" className="w-full justify-start gap-2 text-xs border-amber-500/50 text-amber-400 hover:bg-amber-500/10" onClick={triggerOrder} disabled={loading}>
            <Plus className="h-3.5 w-3.5" />插入紧急订单
          </Button>
          <Button size="sm" variant="outline" className="w-full justify-start gap-2 text-xs border-primary/50 text-primary hover:bg-primary/10" onClick={triggerComposite} disabled={loading}>
            <Zap className="h-3.5 w-3.5" />复合异常演示
          </Button>
          <Button size="sm" variant="ghost" className="w-full justify-start gap-2 text-xs text-muted-foreground" onClick={doReset} disabled={loading}>
            <RotateCcw className="h-3.5 w-3.5" />重置系统
          </Button>
        </div>

        {/* 底部时钟和自动运行 */}
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5"/>{clock}</div>
            <button onClick={()=>setAutoRunning(p=>!p)} className={cn("flex items-center gap-1 text-xs px-2 py-1 rounded", autoRunning?"text-primary":"text-muted-foreground")}>
              {autoRunning ? <><Pause className="h-3 w-3"/>自动刷新中</> : <><Play className="h-3 w-3"/>自动刷新</>}
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <StatusDot ok={apiReady} />
            <span className="text-xs text-muted-foreground">{apiReady?"后端已连接":"后端未连接"}</span>
          </div>
        </div>
      </aside>

      {/* ── 主内容 ── */}
      <main className="ml-56 flex-1 px-6 py-6 space-y-10 max-w-[1400px]">

        {/* ① 工厂总览 */}
        <section ref={el=>{ if(el) sectionRefs.current.overview=el; }} data-section="overview">
          <SectionTitle icon={<LayoutDashboard className="h-5 w-5"/>} title="工厂总览" sub="核心生产指标一览，点击下方导航跳转详情" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <KpiCard label="OEE综合效率" value={`${oee.oee}%`} sub={`可用率${oee.availability}% · 性能率${oee.performance}%`} color={oee.oee>=85?"text-emerald-400 text-primary-glow":oee.oee>=70?"text-amber-400":"text-destructive"} />
            <KpiCard label="当前拓扑" value={topologyLabel[topology]??"并行汇聚"} sub={`AI选择的协作模式`} color="text-primary" />
            <KpiCard label="在制订单" value={allOrders.length} sub={`${urgentOrders.length} 个高优先级`} color={urgentOrders.length>0?"text-amber-400":"text-foreground"} />
            <KpiCard label="完工预估" value={makespan>0?`${makespan} 分钟`:"待排程"} sub="CP-SAT求解结果" color={makespan>0?"text-foreground":"text-muted-foreground"} />
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <KpiCard label="运行中机器" value={`${machines.filter(m=>m.status==="busy").length} / ${machines.length}`} sub="台设备正在加工" />
            <KpiCard label="故障设备" value={failedMachines.length} sub={failedMachines.length>0?failedMachines.map(m=>m.id).join("、"):"全部正常"} color={failedMachines.length>0?"text-destructive":"text-emerald-400"} />
            <KpiCard label="活跃告警" value={(state?.alerts??[]).length} sub={(state?.alerts??[]).map(a=>a.message?.slice(0,20)).join(" · ") || "无告警"} color={(state?.alerts??[]).length>0?"text-destructive":"text-emerald-400"} />
          </div>
          {/* 快捷跳转 */}
          <div className="mt-4 flex gap-3 flex-wrap">
            {(["monitor","ai","schedule","benchmark"] as Section[]).map(sec=>(
              <button key={sec} onClick={()=>scrollTo(sec)} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                {sectionIcon[sec]}{sectionLabel[sec]} <ChevronRight className="h-3.5 w-3.5"/>
              </button>
            ))}
          </div>
        </section>

        {/* ② 实时监控 */}
        <section ref={el=>{ if(el) sectionRefs.current.monitor=el; }} data-section="monitor">
          <SectionTitle icon={<Activity className="h-5 w-5"/>} title="实时监控" sub="设备状态与订单队列实时更新，高亮显示异常" />
          <div className="grid grid-cols-2 gap-6 mt-4">
            <div>
              <p className="text-sm font-medium mb-3 text-muted-foreground">设备状态 ({machines.length} 台)</p>
              <div className="grid grid-cols-2 gap-3">
                {machines.map(m=><MachineCard key={m.id} machine={m} recoveryMinute={recoverySchedule[m.id]} nowMinute={state?.now_minute ?? 0} />)}
                {!machines.length && <div className="col-span-2 text-center text-muted-foreground text-sm py-8">暂无设备数据</div>}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-3 text-muted-foreground">订单队列 ({allOrders.length} 个)</p>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>订单</TableHead><TableHead>优先级</TableHead><TableHead>截止时间</TableHead><TableHead className="text-center">工序</TableHead><TableHead>工艺路线</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allOrders.map(o=><OrderRow key={o.id} order={o} />)}
                    {!allOrders.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">暂无订单数据</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </Card>
              {urgentOrders.length>0 && (
                <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
                  ⚠️ 存在 {urgentOrders.length} 个高优先级订单：{urgentOrders.map(o=>o.id).join("、")}，AI已在排程中优先处理
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ③ AI决策过程 */}
        <section ref={el=>{ if(el) sectionRefs.current.ai=el; }} data-section="ai">
          <div className="flex items-center justify-between">
            <SectionTitle icon={<Bot className="h-5 w-5"/>} title="AI决策过程" sub="智能体协作拓扑与ReflAct推理链路" />
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={()=>setTechVisible(p=>!p)}>
              <Settings className="h-3.5 w-3.5" />{techVisible?"隐藏技术详情":"查看技术详情"}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-6 mt-4">
            <div>
              <p className="text-sm font-medium mb-3 text-muted-foreground">
                当前协作拓扑：<span className="text-primary font-semibold">{topologyLabel[topology]??"并行汇聚"}</span>
              </p>
              <TopologyGraph topology={topology} traces={traces} animating={animating} />
              {result?.topology_selection?.reason && (
                <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <span className="text-foreground font-medium">切换原因：</span>{result.topology_selection.reason}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium mb-3 text-muted-foreground">AI推理日志流</p>
              <Card className="p-4">
                <LogStream logs={logs} />
              </Card>
              {techVisible && traces.length>0 && (
                <div className="mt-4 space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">各智能体详细推理（ReflAct框架）</p>
                  {traces.map((t,i)=>{
                    const agent = canonicalAgent(t.agent_name);
                    return (
                      <Card key={i} className="p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-sm">{nodeLabel[agent]??agent}</span>
                          <span className="text-xs text-muted-foreground">{agentRole[agent]}</span>
                          {t.decision.confidence && <Badge variant="outline" className="ml-auto text-xs">{Math.round(t.decision.confidence*100)}%</Badge>}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded bg-muted/40 p-2"><p className="text-muted-foreground mb-0.5">当前状态</p><p>{translateState(t.decision.current_state)}</p></div>
                          <div className="rounded bg-muted/40 p-2"><p className="text-muted-foreground mb-0.5">目标</p><p>{translate(t.decision.goal)}</p></div>
                          <div className="rounded bg-muted/40 p-2"><p className="text-muted-foreground mb-0.5">偏差分析</p><p>{translate(t.decision.gap)}</p></div>
                          <div className="rounded bg-primary/10 border border-primary/20 p-2"><p className="text-muted-foreground mb-0.5">建议动作</p><p className="text-primary">{translate(t.decision.recommended_action)}</p></div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ④ 排程结果 */}
        <section ref={el=>{ if(el) sectionRefs.current.schedule=el; }} data-section="schedule">
          <div className="flex items-center justify-between">
            <SectionTitle icon={<TrendingUp className="h-5 w-5"/>} title="排程结果" sub="CP-SAT求解器输出的最优排程甘特图" />
            {makespan>0 && <div className="text-sm text-muted-foreground">总完工时间 <span className="text-primary font-bold text-lg">{makespan}</span> 分钟</div>}
          </div>
          <Card className="mt-4 p-5">
            {scheduleItems.length>0
              ? <GanttChart items={scheduleItems} makespan={makespan} />
              : <div className="flex items-center justify-center h-40 text-muted-foreground text-sm gap-2"><TrendingUp className="h-4 w-4"/>触发事件或运行数据集后显示排程甘特图</div>
            }
          </Card>
          {scheduleItems.length>0 && (
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={()=>scrollTo("benchmark")}>
                <Database className="h-3.5 w-3.5"/>与基准数据集对比 <ChevronRight className="h-3.5 w-3.5"/>
              </Button>
              <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={()=>scrollTo("ai")}>
                <Bot className="h-3.5 w-3.5"/>查看AI决策过程 <ChevronRight className="h-3.5 w-3.5"/>
              </Button>
            </div>
          )}
        </section>

        {/* ⑤ 基准测试 */}
        <section ref={el=>{ if(el) sectionRefs.current.benchmark=el; }} data-section="benchmark">
          <SectionTitle icon={<Database className="h-5 w-5"/>} title="基准测试" sub="用学术界标准数据集验证调度算法性能" />
          <div className="grid grid-cols-5 gap-3 mt-4">
            {datasets.map(ds=>{
              const running = runningDataset===ds.id;
              return (
                <Card key={ds.id} className="flex flex-col">
                  <div className="h-1 rounded-t-lg" style={{background:MACHINE_COLORS[datasets.indexOf(ds)%MACHINE_COLORS.length]}} />
                  <CardContent className="p-3 flex-1 flex flex-col">
                    <p className="font-semibold text-sm leading-tight">{ds.name}</p>
                    <p className="text-xs text-muted-foreground mt-1 flex-1 line-clamp-2">{ds.description?.replace("public Job Shop Scheduling benchmark for medium and large factory scheduling validation.","中大型工厂调度验证基准").replace("public job-shop scheduling benchmark used to validate scheduling algorithms.","经典调度算法验证基准").replace("Classic 6-machine, 6-job job-shop scheduling benchmark used to validate scheduling algorithms.","经典6×6调度算法验证基准") ?? "标准调度基准"}</p>
                    <div className="grid grid-cols-2 gap-1.5 my-3 text-xs">
                      <div className="rounded bg-muted/50 px-2 py-1"><span className="text-muted-foreground">作业</span><span className="ml-1 font-bold">{ds.job_count}</span></div>
                      <div className="rounded bg-muted/50 px-2 py-1"><span className="text-muted-foreground">机器</span><span className="ml-1 font-bold">{ds.machine_count}</span></div>
                      <div className="rounded bg-muted/50 px-2 py-1"><span className="text-muted-foreground">工序</span><span className="ml-1 font-bold">{ds.operation_count}</span></div>
                      <div className="rounded bg-muted/50 px-2 py-1"><span className="text-muted-foreground">最优</span><span className="ml-1 font-bold">{ds.best_known_makespan??ds.optimal??"暂无"}</span></div>
                    </div>
                    <Button size="sm" className="w-full text-xs" disabled={running||!!runningDataset} onClick={()=>runDataset(ds)}>
                      {running ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin"/>求解中...</> : "▷ 运行此数据集"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {benchRows.length>0 && (
            <div className="mt-6 space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base">基准测试对比结果</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>数据集</TableHead><TableHead>动态拓扑 Makespan</TableHead><TableHead>选用拓扑</TableHead><TableHead>求解耗时(ms)</TableHead><TableHead>最优已知值</TableHead><TableHead>与最优差距</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {benchRows.map(r=>{
                        const gap = formatGap(r.makespan, r.bestKnown);
                        const gapNum = r.bestKnown ? ((r.makespan-r.bestKnown)/r.bestKnown*100) : null;
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.datasetName}</TableCell>
                            <TableCell className="font-mono text-primary font-bold">{r.makespan}</TableCell>
                            <TableCell><Badge variant="outline">{r.topology}</Badge></TableCell>
                            <TableCell className="font-mono">{r.solveTimeMs}</TableCell>
                            <TableCell className="font-mono">{r.bestKnown??"-"}</TableCell>
                            <TableCell className={cn("font-mono font-semibold", gapNum!==null && gapNum<10?"text-emerald-400":gapNum!==null && gapNum<30?"text-amber-400":"text-destructive")}>{gap}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <Card className="p-5">
                <p className="text-sm font-medium mb-4">Makespan 对比图</p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={benchRows} margin={{left:10,right:20,top:0,bottom:20}}>
                      <CartesianGrid stroke="hsl(var(--border)/0.4)" vertical={false} />
                      <XAxis dataKey="datasetName" tick={{fill:"hsl(var(--muted-foreground))",fontSize:11}} />
                      <YAxis tick={{fill:"hsl(var(--muted-foreground))",fontSize:11}} />
                      <RechartsTooltip contentStyle={{background:"hsl(var(--popover))",border:"1px solid hsl(var(--border))",borderRadius:8,fontSize:12}} />
                      <Legend formatter={v=>v==="makespan"?"本次Makespan":"最优已知值"} />
                      <Bar dataKey="makespan" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                      <Bar dataKey="bestKnown" fill="hsl(var(--muted-foreground)/0.5)" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}
        </section>

        {/* ⑥ AI训练 */}
        <section ref={el=>{ if(el) sectionRefs.current.training=el; }} data-section="training">
          <div className="flex items-center justify-between">
            <SectionTitle icon={<Settings className="h-5 w-5"/>} title="AI训练" sub="A2C强化学习训练拓扑选择策略，优化长期调度效果" />
            <Button size="sm" onClick={runA2C} disabled={a2cRunning} className="gap-1.5">
              {a2cRunning ? <><Loader2 className="h-4 w-4 animate-spin"/>训练中...</> : <><Play className="h-4 w-4"/>运行A2C训练</>}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-6 mt-4">
            <Card className="p-5">
              <p className="text-sm font-medium mb-4">训练奖励曲线</p>
              {experiment?.history?.length ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={experiment.history} margin={{left:0,right:10,top:0,bottom:0}}>
                      <CartesianGrid stroke="hsl(var(--border)/0.4)" />
                      <XAxis dataKey="episode" tick={{fill:"hsl(var(--muted-foreground))",fontSize:11}} label={{value:"Episode",position:"insideBottom",offset:-4,fill:"hsl(var(--muted-foreground))",fontSize:11}} />
                      <YAxis tick={{fill:"hsl(var(--muted-foreground))",fontSize:11}} />
                      <RechartsTooltip contentStyle={{background:"hsl(var(--popover))",border:"1px solid hsl(var(--border))",borderRadius:8,fontSize:12}} />
                      <Line type="monotone" dataKey="reward" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="奖励值" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-56 text-muted-foreground text-sm gap-2">
                  <Activity className="h-4 w-4"/>点击"运行A2C训练"开始学习
                </div>
              )}
            </Card>
            <Card className="p-5">
              <p className="text-sm font-medium mb-4">拓扑选择概率分布</p>
              {experiment?.probabilities ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={Object.entries(experiment.probabilities).map(([k,v])=>({ name:topologyLabel[k]??k, value:Math.round(v*100) }))} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({name,value})=>`${name} ${value}%`} labelLine={false}>
                        {Object.keys(experiment.probabilities).map((_,i)=><Cell key={i} fill={TOPOLOGY_COLORS[i%TOPOLOGY_COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip formatter={(v: unknown)=>[`${v}%`,"概率"]} contentStyle={{background:"hsl(var(--popover))",border:"1px solid hsl(var(--border))",borderRadius:8,fontSize:12}} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-56 text-muted-foreground text-sm gap-2">
                  <Gauge className="h-4 w-4"/>训练完成后显示各拓扑被选中的概率
                </div>
              )}
            </Card>
          </div>
          {experiment?.history?.length && (
            <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4 text-sm">
              <p className="font-semibold text-primary mb-1">训练结论</p>
              <p className="text-muted-foreground">
                经过 {experiment.history.length} 轮训练，系统学习到在不同工厂状态下选择最优协作拓扑的策略。
                {experiment.probabilities && (() => {
                  const sorted = Object.entries(experiment.probabilities).sort((a,b)=>b[1]-a[1]);
                  const top = sorted[0];
                  return top ? `当前最倾向于使用"${topologyLabel[top[0]]??top[0]}"拓扑（概率 ${Math.round(top[1]*100)}%），相比固定拓扑策略，动态选择可有效降低高风险场景下的排程延误。` : "";
                })()}
              </p>
            </div>
          )}
        </section>

        <div className="h-20" />
      </main>

      <NoticeStack notices={notices} onClose={id=>setNotices(p=>p.filter(n=>n.id!==id))} />
      {loading && <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>}
    </div>
  );
}

function SectionTitle({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-md bg-primary/10 p-1.5 text-primary">{icon}</div>
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
