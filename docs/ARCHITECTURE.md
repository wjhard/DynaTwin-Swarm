# DynaTwin-Swarm Architecture

## Existing GPTSwarm Reuse

The extension keeps the original GPTSwarm primitives intact:

- `Graph` runs asynchronous DAGs of `Node` instances.
- `CompositeGraph` embeds agent graphs and learned inter-agent edges.
- `Swarm` builds multi-agent graphs through `AgentRegistry` and `OperationRegistry`.
- `EdgeWiseDistribution` remains available for GPTSwarm REINFORCE-style optimization.
- `LLMRegistry` still resolves GPT and mock providers for the original tasks.

## New Industrial Layers

```text
FactorySimulator
  -> FactoryState / TaskProfile
  -> RuleBasedGraphSelector or MLGraphSelector
  -> IndustrialTopologyExecutor
  -> ReflAct industrial agents
  -> IndustrialScheduleSolver
  -> ConstraintValidator / RewardCalculator
  -> Repository and dashboard events
```

## Digital Twin

The digital twin stores machines, operations, orders, materials, workers, alerts, schedule plans, violations, topology selections, and execution records as Pydantic models. Stores include in-memory and SQLite implementations.

Time is represented as minutes since the 08:00 shift start. This keeps due dates deterministic: 15:30 is 450, 16:00 is 480, and 18:00 is 600.

The `FactorySimulator` provides:

- base state generation with fixed random seed support.
- named scenarios for normal scheduling, composite incident, multi-resource conflict, single-machine failure, inventory shortage, and worker-skill mismatch.
- stepwise event application.
- direct final abnormal state generation.
- JSON import/export and a CLI wrapper at `scripts/simulate_factory.py`.

## ReflAct Agent Contract

Each industrial agent returns a `ReflActDecision` with:

- `current_state`
- `goal`
- `gap`
- `constraints`
- `risk_level`
- `recommended_action`
- `evidence`
- `confidence`

The system stores auditable evidence and recommendations only.

The concrete agents are:

- `TaskRouterAgent`
- `MonitorAgent`
- `DiagnosisAgent`
- `OrderAgent`
- `ResourceAgent`
- `ScheduleAgent`
- `ConstraintAgent`
- `RiskAgent`
- `CriticAgent`
- `ReportAgent`

`ReflActStep` executes a list of industrial agents and validates every decision. Invalid structured output is converted to a deterministic fallback decision with evidence explaining the validation failure.

## Dynamic Topology

The initial topology registry contains:

- `serial_chain`
- `parallel_fusion`
- `supervisor_tree`
- `high_risk_review`

The rule selector chooses based on task type, risk, resource conflict count, parallel-analysis needs, and critic-review needs. The ML selector learns the same mapping from generated scheduling runs and falls back to rules when no trained model is available.

`IndustrialTopologyExecutor` is the adapter between topology templates and industrial ReflAct agents. It executes topology nodes in topological order and records one `AgentDecisionTrace` per node. This keeps the industrial graph layer separate from the original GPTSwarm graph implementation while preserving the graph-as-control-flow model.

`MLGraphSelector` encodes task profile features and trains a local RandomForest classifier. `ModelArtsLoRAGraphSelectorTrainer` exposes the cloud training contract and uses the ModelArts mock client unless configured otherwise.

`A2CEdgeOptimizer` keeps a separate actor-critic workflow for industrial topology candidates. It updates topology logits with an advantage term, updates a table-based critic per task type, and stores the Top-K candidate graph definitions for downstream selection.

## Scheduling

The schedule solver uses OR-Tools CP-SAT when available and falls back to deterministic greedy scheduling if CP-SAT import or solve fails. Hard constraints are validated separately so LLM output cannot bypass safety or resource rules.

The solver returns a dictionary with `best_plan`, `alternative_plans`, `violations`, and `metrics`. Resource feasibility is pre-filtered for failed machines, machine capability, material availability, and worker skill availability before CP-SAT builds machine interval variables and NoOverlap constraints.

## Huawei and Ascend Boundary

Huawei-facing classes live under `swarm/integrations/huawei`. Local development uses mock adapters for PanguLM, MindIE, GaussDB, OBS, IoTDA, EventGrid, FunctionGraph, and ModelArts.

Adapter status is explicit: missing credentials produce mock/fallback states, not synthetic cloud success.

## Deployment

`docker-compose.yml` defines separate backend and frontend services. The backend defaults to local mock mode and SQLite. The frontend serves the built Vite dashboard through Nginx in Docker or through Vite during development.

## Persistence

`swarm/persistence` exposes repository contracts for states, schedules, traces, topology selections, events, and experiment summaries. SQLite is the default. GaussDB uses the same contract and is adapter-gated.

## Frontend and Backend

FastAPI exposes task, event, state, schedule, trace, topology, event, experiment, and WebSocket dashboard endpoints. The React dashboard renders machines, orders, materials, topology, ReflAct traces, Gantt rows, risk, alternatives, history, and Huawei adapter status.

`backend.service.DynaTwinService` owns the local orchestration path. `backend.main.create_app` accepts a repository for tests and defaults to `SQLiteRepository` for local runtime.

The frontend is a single React/Vite page. It uses React Flow for topology visualization, Recharts for schedule metrics, and lucide-react icons for controls. The Vite dev server proxies `/api`, `/health`, and `/ws` to the FastAPI backend.

## Milestone Execution Notes

The local repository was initialized because the downloaded source tree had no `.git` directory. External cloud connection status must remain `mock` or fallback unless real credentials are supplied and verified.
