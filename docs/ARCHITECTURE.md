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

## Dynamic Topology

The initial topology registry contains:

- `serial_chain`
- `parallel_fusion`
- `supervisor_tree`
- `high_risk_review`

The rule selector chooses based on task type, risk, resource conflict count, parallel-analysis needs, and critic-review needs. The ML selector learns the same mapping from generated scheduling runs and falls back to rules when no trained model is available.

## Scheduling

The schedule solver uses OR-Tools CP-SAT when available and falls back to deterministic greedy scheduling if CP-SAT import or solve fails. Hard constraints are validated separately so LLM output cannot bypass safety or resource rules.

## Huawei and Ascend Boundary

Huawei-facing classes live under `swarm/integrations/huawei`. Local development uses mock adapters for PanguLM, MindIE, GaussDB, OBS, IoTDA, EventGrid, FunctionGraph, and ModelArts.

## Persistence

`swarm/persistence` exposes repository contracts for states, schedules, traces, topology selections, events, and experiment summaries. SQLite is the default. GaussDB uses the same contract and is adapter-gated.

## Frontend and Backend

FastAPI exposes task, event, state, schedule, trace, topology, event, experiment, and WebSocket dashboard endpoints. The React dashboard renders machines, orders, materials, topology, ReflAct traces, Gantt rows, risk, alternatives, history, and Huawei adapter status.

## Milestone Execution Notes

The local repository was initialized because the downloaded source tree had no `.git` directory. External cloud connection status must remain `mock` or fallback unless real credentials are supplied and verified.
