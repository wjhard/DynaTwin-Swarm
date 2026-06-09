# DynaTwin-Swarm

DynaTwin-Swarm is an incremental industrial scheduling extension for GPTSwarm. It models a lightweight manufacturing digital twin, routes each incident through a dynamic multi-agent topology, applies ReflAct-style state-goal reflection, validates hard production constraints, and solves schedules with a deterministic local path.

## Paper-Grounded Design

- DynaSwarm motivates per-input topology selection instead of one fixed multi-agent graph. This project implements rule-based, trainable, and A2C Top-K graph selection.
- GPTSwarm's original REINFORCE optimizer remains as the baseline. A new A2C optimizer is added beside it.
- ReflAct motivates grounding each agent decision in the current state, goal, gap, constraints, risk, evidence, action, and confidence. This project stores those fields without exposing hidden reasoning traces.

## Local Default

The default execution path is fully local:

```text
Factory Simulator -> Local Event Bus -> FastAPI -> DynaTwin-Swarm -> SQLite -> Dashboard
```

Huawei Cloud and Ascend integrations are adapter-backed and default to mocks unless credentials and endpoints are provided.

## Key Commands

```powershell
C:\Anaconda\python.exe -m pytest -q
C:\Anaconda\python.exe scripts/run_local_demo.py
C:\Anaconda\python.exe scripts/generate_selector_dataset.py
C:\Anaconda\python.exe scripts/train_graph_selector.py
C:\Anaconda\python.exe scripts/evaluate_selector.py
C:\Anaconda\python.exe scripts/run_a2c_experiment.py
C:\Anaconda\python.exe scripts/export_topk_graphs.py
cd frontend
npm install
npm run build
```

## Demo Scenario

The main scenario combines:

- M3 overheat and forced stop.
- urgent order O4 due at 15:30.
- O2 and O4 contention for precision machining.
- material shortage that prevents unconditional fulfillment.
- safety-first scheduling with alternatives and risk explanation.

Additional scenarios cover normal scheduling, multi-resource conflict, single-machine failure, inventory shortage, and worker-skill mismatch.

## Digital Twin Models

Milestone 1 adds Pydantic models for machines, operations, orders, materials, workers, machine alerts, factory state, schedule plans, constraint violations, task profiles, ReflAct decisions, topology selections, and execution records.

The simulator can be run locally:

```powershell
C:\Anaconda\python.exe scripts/simulate_factory.py --scenario main
C:\Anaconda\python.exe scripts/simulate_factory.py --scenario normal --output data/normal_state.json
```

State can be stored in memory for tests or SQLite for the local demo.

## Industrial ReflAct Agents

The industrial agent set includes task routing, monitoring, diagnosis, order analysis, resource analysis, scheduling, constraint validation, risk review, critic review, and reporting. Each agent emits the same `ReflActDecision` schema and records elapsed time plus evidence in `AgentDecisionTrace`.

Supported provider names are `mock`, `pangu`, `mindie`, and `openai_optional`. Without credentials, the non-local providers return explicit mock fallback notes instead of pretending to be connected.
