# DynaTwin-Swarm 优化说明

## 本轮已完成的优化

本轮针对两个问题做了实际改造：

1. 原系统主要依赖本地模拟场景，缺少公开数据集支撑。
2. 前端还是英文技术 Demo 风格，不够像中文工业软件。

## 1. 公开数据集接入

已新增 JSPLib FT06、Lawrence LA40、Adams-Balas-Zawack ABZ9、Storer-Wu-Vaccari SWV20、Demirkol-Mehta-Uzsoy DMU80 等公开 Job Shop Scheduling benchmark。

数据文件：

```text
datasets/public_jobshop/jsplib_ft06.json
datasets/public_jobshop/la40.json
datasets/public_jobshop/abz9.json
datasets/public_jobshop/swv20.json
datasets/public_jobshop/dmu80.json
```

适配代码：

```text
swarm/datasets/public_jobshop.py
```

后端接口：

```text
GET  /api/datasets/public
POST /api/datasets/public/jsplib_ft06/run
POST /api/datasets/public/abz9/run
POST /api/datasets/public/dmu80/run
```

当前公开数据规模：

| 指标 | 数值 |
| --- | --- |
| FT06 | 6 台机器 / 6 个作业 / 36 道工序 |
| LA40 | 15 台机器 / 15 个作业 / 225 道工序 |
| ABZ9 | 15 台机器 / 20 个作业 / 300 道工序 |
| SWV20 | 10 台机器 / 50 个作业 / 500 道工序 |
| DMU80 | 20 台机器 / 50 个作业 / 1000 道工序 |

运行链路：

```text
公开 Job Shop benchmark
  -> FactoryState
  -> 大规模任务画像
  -> Graph Selector
  -> ReflAct Agents
  -> CP-SAT / Greedy Scheduler
  -> Dashboard
```

前端现在可以在“公开数据集中心”点击运行任一公开数据集。运行后，决策摘要会显示：

```text
当前正在使用公开基准数据集 AdamsBalasZawack ABZ9，包含 20 个作业、15 台机器、300 道工序。
```

## 2. 前端中文化和界面重构

前端已经从英文单页 Demo 改为中文工业调度看板。

主要变化：

- 新增左侧导航：总览、数据集、智能体、排程、事件。
- 标题改为 `DynaTwin-Swarm 智能排产系统`。
- 顶部说明改为中文业务描述。
- 新增“当前决策摘要”。
- 新增关键指标卡片：运行状态、当前场景、风险等级、已排工序、当前拓扑。
- 新增“公开数据集中心”。
- 新增“调度对比”模块。
- 设备、订单、库存、风险、拓扑、Agent 决策、甘特图、事件流、历史记录全部中文化。
- Agent 拓扑节点改成中文业务名称，例如任务路由、状态监控、调度求解、约束校验、风险评估。

## 3. 当前前端模块

| 模块 | 说明 |
| --- | --- |
| 左侧导航 | 快速跳转到总览、数据集、智能体、排程和事件 |
| 顶部状态栏 | 展示 API、PanguLM、MindIE、GaussDB、OBS 等状态 |
| 工具栏 | 触发正常排产、M3 过热、紧急订单、组合异常、FT06、大型公开数据集和重置 |
| 当前决策摘要 | 用一句话说明当前系统判断 |
| 指标卡片 | 展示运行状态、风险、拓扑和已排工序 |
| 设备状态 | 展示设备状态、温度、工单和能力 |
| 订单队列 | 展示订单优先级、截止时间和工序数量 |
| 物料库存 | 展示当前可用库存 |
| 调度对比 | 对比上次和当前 makespan，并显示公开最优参考 |
| 公开数据集中心 | 展示并运行 FT06、LA40、ABZ9、SWV20、DMU80 |
| 动态智能体拓扑 | 展示本次选择的 Agent 协作图 |
| ReflAct 智能体决策链 | 展示 Agent 决策和 provider evidence |
| 生产排程甘特图 | 展示每道工序的机器和时间安排 |
| 工序耗时指标 | 展示工序耗时柱状图 |
| 事件流 | 展示系统事件 |
| 运行历史 | 展示历史运行记录 |

## 4. 还建议继续优化

下一阶段建议继续做：

1. 继续接入更多公开数据集，例如 Taillard Job Shop、NASA C-MAPSS、UCI SECOM。
2. 增加实验评估页，对比 CP-SAT、Greedy、A2C 和不同 Graph Selector。
3. 增加设备健康预测模块，用公开退化数据支撑设备风险。
4. 增加质量风险预测模块，用 SECOM 类数据支撑良率分析。
5. 增加人工审批流程，高风险调度方案需要人工确认。
6. 使用 shadcn/ui 或类似组件体系继续提升视觉一致性。
7. 引入 OpenTelemetry 记录 Agent trace、耗时和调用状态。
8. 接入真实盘古 API 后展示真实 LLM 决策内容。

## 5. 展示时可以强调

可以这样讲：

```text
系统当前不只依赖本地模拟场景，还接入了 FT06、LA40、ABZ9、SWV20、DMU80 等公开 Job Shop Scheduling benchmark，最大可以直接运行 20 台机器、50 个作业、1000 道工序的 DMU80 压力实例。
公开数据集会被转换成数字孪生工厂状态，再经过大规模任务画像、动态 Agent 拓扑选择、ReflAct 决策链和调度求解器，最终在中文工业看板中展示排程结果。
这说明系统具备从公开 benchmark 到工业调度决策的完整闭环。
```
