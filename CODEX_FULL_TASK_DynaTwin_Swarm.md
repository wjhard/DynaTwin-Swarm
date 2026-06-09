# DynaTwin-Swarm：Codex 全量开发任务书

> 用法：把本文件放到 GPTSwarm 仓库根目录，命名为 `CODEX_FULL_TASK.md`，然后将全文交给 Codex。  
> 要求 Codex 自动完成所有阶段；除非遇到真实云资源、账号权限或系统环境阻塞，否则不要等待人工确认。  
> 没有华为云密钥时，必须使用 mock 与 Adapter 完成可运行 Demo，不得伪造真实连接。

---

# 1. 项目目标

在当前 GPTSwarm 基础项目上进行增量改造，完成：

# DynaTwin-Swarm  
## 基于动态图多智能体协作、目标状态反思与华为昇腾技术栈的工业韧性调度系统

系统面向离散制造车间中的设备故障、紧急插单、库存不足、人员冲突和订单延期等动态事件，自动选择合适的 Agent 协作拓扑，持续进行状态—目标反思，并通过工业调度求解器输出满足硬约束的新排产方案。

完整闭环：

```text
设备与业务事件
↓
轻量级工业数字孪生状态
↓
任务画像：类型、复杂度、风险、资源冲突
↓
Graph Selector 动态选择 Agent 拓扑
↓
多 Agent 协同执行
↓
ReflAct 结构化状态—目标反思
↓
OR-Tools CP-SAT 排产求解与规则校验
↓
RiskAgent 与 CriticAgent 复核
↓
最终排产、备用方案、风险解释、日志
↓
历史数据反馈
↓
Graph Selector 训练与 A2C Top-K 图优化
```

---

# 2. 基础代码与论文参考

## 2.1 GPTSwarm

复用当前仓库中的：

- Graph、Node、Composite Graph；
- Swarm 执行流程；
- Agent 注册机制；
- Operation；
- LLM Provider；
- Edge Optimizer；
- Memory；
- Experiments；
- Tests。

原则：

1. 增量改造，不推倒重写；
2. 修改核心文件前先阅读现有实现；
3. 保留原有测试；
4. 保持 Python 3.10 兼容；
5. 新模块优先通过 Adapter 与现有代码连接。

## 2.2 DynaSwarm

若仓库中存在 `references/DynaSwarm.pdf`，阅读后实现：

1. 保留 GPTSwarm 原始 REINFORCE 作为基线；
2. 新增 A2C 图结构优化；
3. 保存 Top-K 候选 Agent 图；
4. 为每个输入任务动态选择拓扑；
5. 规则版 Graph Selector 作为稳定兜底；
6. ML Graph Selector 作为可训练模块；
7. 为 ModelArts LoRA 微调预留接口。

## 2.3 ReflAct

若仓库中存在 `references/ReflAct.pdf`，阅读后实现工业版 ReflAct。

每个 Agent 必须输出 Pydantic 结构化对象：

```json
{
  "current_state": "当前状态",
  "goal": "任务目标",
  "gap": "状态与目标之间的偏差",
  "constraints": ["约束1", "约束2"],
  "risk_level": "low | medium | high | critical",
  "recommended_action": "建议动作",
  "evidence": ["证据1", "证据2"],
  "confidence": 0.85
}
```

不要展示模型完整思维链，只输出可审计的决策依据。

---

# 3. 华为技术接入要求

以下技术必须进入架构，并提供 Adapter 与 mock：

| 华为技术 | 用途 |
|---|---|
| PanguLM / 盘古大模型 API | Agent 推理与决策解释 |
| ModelArts Studio | Graph Selector 训练、LoRA 接口、模型管理 |
| MindIE | 昇腾环境推理服务 |
| CANN | MindIE / 昇腾部署说明 |
| GaussDB | 状态、任务、日志、方案、评分存储 |
| OBS | 数据集、模型、日志、报告存储 |
| IoTDA | 接收设备状态与告警 |
| EventGrid | 事件路由 |
| FunctionGraph | 异常事件触发后端 API |

默认本地链路：

```text
Factory Simulator → Local Event Bus → FastAPI → DynaTwin-Swarm
```

华为云链路：

```text
设备 / Simulator → MQTT → IoTDA → EventGrid → FunctionGraph → FastAPI
```

没有华为云凭据时：

- 仍然完成 Adapter；
- 使用 mock；
- 完成配置模板；
- 完成接入文档；
- 不阻塞本地 Demo。

---

# 4. 主 Demo 场景

必须完整实现：

## 设备故障 + 紧急插单 + 物料冲突

```text
M1：切割设备，忙碌
M2：切割设备，可用
M3：精加工设备，正在执行订单 O2
M4：精加工设备，可用，但效率较低

O1：普通订单，交期 18:00
O2：重点订单，交期 16:00
O3：普通订单，交期次日
O4：紧急插单，交期 15:30

异常：
1. M3 温度超过阈值，必须立即停机；
2. O4 与 O2 争夺精加工设备；
3. 可用材料不足以无条件满足所有订单；
4. 必须在安全约束下最小化延期；
5. 必须输出备用方案。
```

另外实现至少 4 个扩展场景：

1. 普通排产；
2. 多资源冲突；
3. 单设备故障；
4. 库存不足；
5. 可选：人员技能不匹配。

---

# 5. 建议目录

按仓库实际情况调整，但必须保持模块边界清晰：

```text
swarm/
├── domain/manufacturing/
├── selector/
├── environment/agents/industrial/
├── environment/operations/
├── graph/
├── optimizer/edge_optimizer/
├── llm/
├── integrations/huawei/
└── persistence/

backend/
frontend/
scripts/
deployment/
docs/
tests/
```

至少新增：

```text
AGENTS.md
README_DYNATWIN.md
.env.example
docker-compose.yml
docs/ARCHITECTURE.md
docs/API.md
docs/HUAWEI_INTEGRATION.md
docs/DEPLOYMENT_ASCEND.md
docs/EXPERIMENTS.md
docs/DEMO_SCRIPT.md
```

---

# 6. 全量执行规则

从 Milestone 0 自动执行到 Milestone 10。

每完成一个 Milestone：

1. 运行相关测试；
2. 修复失败测试；
3. 更新文档；
4. 执行 `git status`；
5. 执行 `git diff --stat`；
6. 创建 Git commit；
7. 自动进入下一阶段。

禁止：

1. 删除原 GPTSwarm 核心功能；
2. 跳过测试；
3. 提交真实密钥；
4. 把 `.env` 提交到 Git；
5. 伪造云服务连接成功；
6. 伪造测试结果；
7. 让大模型绕过工业约束求解器直接给出最终排产。

---

# 7. Milestone 0：仓库分析与规范

完成：

1. 阅读当前 GPTSwarm；
2. 找到 Swarm、Graph、Composite Graph、Node、Agent、Operation、LLM Provider、Edge Optimizer、Experiments、Tests；
3. 检查依赖与 Python 版本；
4. 创建 `AGENTS.md`；
5. 创建 `.env.example`；
6. 创建 `README_DYNATWIN.md` 初稿；
7. 创建 `docs/ARCHITECTURE.md`；
8. 输出增量改造计划。

`AGENTS.md` 必须包括：

```text
Project
Development Principles
Repository Map
Architecture Boundaries
Required Commands
Testing Rules
Git Rules
Cloud Adapter Rules
Security Rules
Milestone Rules
```

Commit：

```text
docs: initialize DynaTwin-Swarm architecture and development rules
```

---

# 8. Milestone 1：工业数字孪生与数据模型

使用 Pydantic 实现：

```text
Machine
Operation
Order
Material
Worker
MachineAlert
FactoryState
ScheduleItem
SchedulePlan
ConstraintViolation
TaskProfile
AgentDecisionTrace
ReflActDecision
TopologySelection
ExecutionRecord
```

实现：

```text
FactoryStateStore
InMemoryFactoryStateStore
SQLiteFactoryStateStore
FactorySimulator
```

Simulator 要求：

- 固定随机种子；
- 支持主场景与扩展场景；
- 支持逐步触发事件；
- 支持直接生成最终异常状态；
- 支持 JSON 导入导出；
- 支持 CLI。

测试：

```text
test_factory_simulator.py
test_factory_state_store.py
test_reflact_schema.py
```

Commit：

```text
feat: add manufacturing domain models and local digital twin simulator
```

---

# 9. Milestone 2：工业 Agent 与 ReflAct

实现：

```text
BaseIndustrialAgent
TaskRouterAgent
MonitorAgent
DiagnosisAgent
OrderAgent
ResourceAgent
ScheduleAgent
ConstraintAgent
RiskAgent
CriticAgent
ReportAgent
ReflActStep
```

支持：

```text
provider=mock
provider=pangu
provider=mindie
provider=openai_optional
```

要求：

- 所有 Agent 输出统一结构；
- 无密钥时 deterministic mock 可运行；
- 结构化结果校验失败时自动回退；
- 记录执行时间和 evidence。

测试：

```text
test_industrial_agents.py
test_reflact_step.py
test_mock_llm_provider.py
```

Commit：

```text
feat: add ReflAct industrial agents and mock LLM provider
```

---

# 10. Milestone 3：动态图拓扑与规则版 Graph Selector

实现 4 种拓扑：

```text
serial_chain
parallel_fusion
supervisor_tree
high_risk_review
```

拓扑定义：

```text
serial_chain:
TaskRouter → Monitor → Schedule → Constraint → Report

parallel_fusion:
TaskRouter → Monitor → {Diagnosis, Order, Resource} 并行
→ Schedule → Constraint → Report

supervisor_tree:
TaskRouter → Supervisor → {Diagnosis, Order, Resource, Risk} 并行
→ Schedule → Constraint → Critic → Report

high_risk_review:
TaskRouter → Monitor → {Diagnosis, Order, Resource} 并行
→ Schedule → Constraint → Risk ↔ Critic → FinalDecision → Report
```

实现 `RuleBasedGraphSelector`，根据：

```text
task_type
risk_level
resource_conflict_count
requires_parallel_analysis
requires_critic_review
```

选择拓扑。

规则：

```text
普通任务       → serial_chain
多资源冲突     → parallel_fusion
复杂复合任务   → supervisor_tree
高风险设备异常 → high_risk_review
```

尽量复用 GPTSwarm Composite Graph；若不适配，增加 Adapter，不破坏原逻辑。

测试：

```text
test_topology_registry.py
test_graph_selector.py
test_topology_execution.py
```

Commit：

```text
feat: add industrial topology templates and rule-based graph selector
```

---

# 11. Milestone 4：OR-Tools CP-SAT 调度求解

集成：

```text
ortools
```

实现：

```text
IndustrialScheduleSolver
ConstraintValidator
RewardCalculator
```

硬约束至少包括：

1. 同一设备同一时间只能执行一个工序；
2. 故障设备禁止排产；
3. 工序满足前后依赖；
4. 设备能力匹配；
5. 库存满足需求；
6. 人员技能匹配；
7. 订单交期；
8. 紧急订单优先；
9. 安全等级；
10. 设备切换成本。

目标函数：

```text
Reward =
  - 延期分钟数 × 0.40
  - 安全风险 × 0.30
  - 切换成本 × 0.15
  - 库存浪费 × 0.10
  - Agent 调用成本 × 0.05
```

输出：

```text
best_plan
alternative_plans
violations
metrics
```

测试：

```text
test_schedule_solver.py
test_machine_failure_constraint.py
test_urgent_order_priority.py
test_inventory_constraint.py
test_worker_skill_constraint.py
```

Commit：

```text
feat: add CP-SAT scheduling solver and industrial constraint validation
```

---

# 12. Milestone 5：FastAPI、SQLite 与 WebSocket

实现 Repository：

```text
Repository
SQLiteRepository
GaussDBRepository
```

实现 API：

```text
GET  /health
POST /api/tasks/run
POST /api/events/machine-alert
POST /api/events/order-created
GET  /api/state
GET  /api/schedules/latest
GET  /api/traces/latest
GET  /api/topology/latest
GET  /api/events/latest
GET  /api/experiments/latest
WS   /ws/dashboard
```

`POST /api/tasks/run` 返回：

```json
{
  "task_id": "...",
  "task_profile": {},
  "selected_topology": "high_risk_review",
  "agent_traces": [],
  "best_plan": {},
  "alternative_plans": [],
  "risk_summary": {},
  "metrics": {}
}
```

测试：

```text
test_repository.py
test_api.py
test_websocket.py
test_end_to_end_demo.py
```

Commit：

```text
feat: add FastAPI backend SQLite repository and WebSocket dashboard events
```

---

# 13. Milestone 6：前端看板

使用：

```text
React + Vite + TypeScript
React Flow
ECharts 或 Recharts
```

实现单页 Dashboard，必须显示：

1. 设备状态；
2. 订单；
3. 库存；
4. 实时事件流；
5. 动态 Agent 拓扑；
6. ReflAct 决策卡片；
7. 甘特图；
8. 风险等级；
9. 备用方案；
10. 历史任务；
11. Graph Selector 选择结果；
12. 华为技术接入状态。

按钮：

```text
Run Normal Scheduling
Trigger M3 Overheat
Create Urgent Order O4
Run Composite Incident Demo
Reset Demo
```

华为技术状态：

```text
PanguLM: mock / connected
MindIE: mock / connected
GaussDB: sqlite fallback / connected
OBS: local fallback / connected
IoTDA: local event bus / connected
EventGrid: local router / connected
FunctionGraph: local trigger / connected
ModelArts: local training / connected
```

Commit：

```text
feat: add industrial digital twin dashboard and topology visualization
```

---

# 14. Milestone 7：华为云与昇腾 Adapter

环境变量：

```text
APP_ENV=local
LLM_PROVIDER=mock
DATABASE_PROVIDER=sqlite
EVENT_PROVIDER=local
OBJECT_STORAGE_PROVIDER=local
TRAINING_PROVIDER=local

PANGU_BASE_URL=
PANGU_API_KEY=
MINDIE_BASE_URL=
GAUSSDB_DSN=
OBS_BUCKET=
IOTDA_ENDPOINT=
EVENTGRID_ENDPOINT=
FUNCTIONGRAPH_ENDPOINT=
MODELARTS_ENDPOINT=
```

实现：

```text
PanguChatProvider
MindIEChatProvider
GaussDBRepository
OBSClient
IoTDAClient
EventGridHandler
FunctionGraphHandler
ModelArtsClient
```

Mock：

```text
MockPanguChatProvider
MockMindIEProvider
MockGaussDBRepository
MockOBSClient
MockIoTDAClient
MockEventGridHandler
MockFunctionGraphHandler
MockModelArtsClient
```

文档：

```text
docs/HUAWEI_INTEGRATION.md
docs/DEPLOYMENT_ASCEND.md
```

测试：

```text
test_huawei_mocks.py
test_huawei_config.py
test_huawei_adapter_contracts.py
```

Commit：

```text
feat: add Huawei Cloud and Ascend adapters with local mocks
```

---

# 15. Milestone 8：可训练 Graph Selector

实现数据生成：

```text
scripts/generate_selector_dataset.py
```

流程：

```text
生成工业任务
↓
分别运行 4 种拓扑
↓
记录 Reward
↓
标注最佳拓扑
↓
输出 selector_dataset.jsonl
```

特征：

```text
task_type
risk_level
machine_alert_count
urgent_order_count
resource_conflict_count
inventory_shortage_count
worker_conflict_count
requires_parallel_analysis
requires_critic_review
```

实现：

```text
MLGraphSelector
ModelArtsLoRAGraphSelectorTrainer
```

本地默认：

```text
scikit-learn LogisticRegression
或 RandomForestClassifier
```

要求：

- 训练；
- 保存；
- 加载；
- 预测；
- 输出置信度；
- 规则版 fallback；
- ModelArts LoRA 接口与 mock；
- 数据格式文档。

脚本：

```text
scripts/generate_selector_dataset.py
scripts/train_graph_selector.py
scripts/evaluate_selector.py
```

测试：

```text
test_selector_dataset.py
test_ml_graph_selector.py
test_selector_training.py
```

Commit：

```text
feat: add trainable graph selector and ModelArts LoRA training interface
```

---

# 16. Milestone 9：A2C 图结构优化与 Top-K 图

保留 GPTSwarm 原 REINFORCE。

新增：

```text
A2CEdgeOptimizer
CriticNetwork
CandidateGraphStore
A2CExperimentRunner
```

逻辑：

```text
初始化边概率参数 Θ
↓
采样候选图 G
↓
运行工业任务并获得 Reward
↓
Critic 估计 V(Θ)
↓
Advantage = Reward - V(Θ)
↓
更新 Actor
↓
更新 Critic
↓
保存 Top-K 图
```

图保存格式：

```json
{
  "graph_id": "...",
  "nodes": [],
  "edges": [],
  "score": 0.0,
  "task_type": "...",
  "metadata": {}
}
```

实验比较：

```text
Fixed Serial
Fixed Parallel
Rule-based Selector
GPTSwarm REINFORCE
A2C Top-1
A2C Top-K + ML Selector
A2C Top-K + ML Selector + ReflAct
```

脚本：

```text
scripts/run_a2c_experiment.py
scripts/export_topk_graphs.py
```

测试：

```text
test_a2c_optimizer.py
test_candidate_graph_store.py
test_a2c_experiment_runner.py
```

Commit：

```text
feat: add A2C edge optimization and Top-K candidate graph workflow
```

---

# 17. Milestone 10：实验、Docker、文档与最终验收

生成：

```text
reports/experiments/results.csv
reports/experiments/summary.json
reports/experiments/figures/
```

对比：

| 系统 | 说明 |
|---|---|
| Single Agent | 单 Agent |
| Fixed Serial | 固定串行多 Agent |
| Fixed Parallel | 固定并行多 Agent |
| GPTSwarm REINFORCE | 原始图优化 |
| Dynamic without ReflAct | 动态图但无反思 |
| Proposed | 动态图 + ReflAct + 约束校验 + 反馈优化 |

指标：

```text
订单平均延期时间
高优先级订单按时交付率
安全约束违反次数
不可执行方案比例
异常响应时间
Agent 调用次数
平均推理时延
Token 估算成本
Graph Selector 准确率
Reward
拓扑选择分布
方案解释完整度
```

完善：

```text
docker-compose.yml
README_DYNATWIN.md
docs/ARCHITECTURE.md
docs/API.md
docs/HUAWEI_INTEGRATION.md
docs/DEPLOYMENT_ASCEND.md
docs/EXPERIMENTS.md
docs/DEMO_SCRIPT.md
```

实现 Demo：

```text
scripts/run_local_demo.py
```

输出：

```text
1. 初始状态
2. M3 高温告警
3. O4 紧急插单
4. Task Profile
5. 选择的拓扑
6. Agent ReflAct Trace
7. 淘汰的不可执行方案
8. 最终排产
9. 备用方案
10. 风险说明
11. 指标变化
12. 华为技术状态
```

Commit：

```text
docs: complete deployment demo and experiment documentation
```

---

# 18. 最终必须运行的命令

后端测试：

```bash
pytest -q
```

后端启动：

```bash
uvicorn backend.main:app --reload
```

本地 Demo：

```bash
python scripts/run_local_demo.py
```

前端：

```bash
cd frontend
npm install
npm run build
```

Graph Selector：

```bash
python scripts/generate_selector_dataset.py
python scripts/train_graph_selector.py
python scripts/evaluate_selector.py
```

A2C：

```bash
python scripts/run_a2c_experiment.py
python scripts/export_topk_graphs.py
```

Docker：

```bash
docker compose up --build
```

如果某命令因环境不可用失败：

1. 记录真实报错；
2. 不伪造成功；
3. 完成其余可完成工作；
4. 在最终报告中说明。

---

# 19. 最终报告

完成后输出：

```text
1. 项目概述
2. 架构说明
3. GPTSwarm 复用点
4. DynaSwarm 创新实现
5. ReflAct 创新实现
6. 华为技术接入点
7. mock 与真实连接状态
8. 新增文件列表
9. 修改文件列表
10. 依赖列表
11. 测试命令与结果
12. 前端构建结果
13. Demo 运行结果
14. Docker 结果
15. Graph Selector 训练结果
16. A2C 实验结果
17. 已实现功能
18. 仅 mock 功能
19. 外部阻塞项
20. 风险与后续建议
21. git log --oneline
22. git diff --stat
```

---

# 20. 立即执行

请现在开始，从 Milestone 0 自动执行到 Milestone 10。

要求：

```text
自动推进
自动测试
自动修复
自动提交
无云密钥时使用 mock
不等待人工确认
不伪造测试结果
不伪造云服务状态
```

开始执行。
