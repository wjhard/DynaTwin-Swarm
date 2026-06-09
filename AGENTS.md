# Project

DynaTwin-Swarm extends GPTSwarm into an industrial digital twin scheduling demo. The work must stay incremental: reuse GPTSwarm Graph, Node, CompositeGraph, Swarm, AgentRegistry, OperationRegistry, LLM provider, memory, and edge optimizer abstractions wherever they fit.

# Development Principles

- Keep GPTSwarm core behavior compatible with the existing tests.
- Add industrial capabilities as domain modules, adapters, providers, and scripts.
- Prefer deterministic local mock execution when external credentials are absent.
- Keep Python code compatible with Python 3.10+, even when the local interpreter is newer.
- Do not expose full chain-of-thought; persist only auditable ReflAct decision fields.

# Repository Map

- `swarm/graph`: existing graph and swarm execution primitives.
- `swarm/environment/agents`: existing agents plus industrial agents.
- `swarm/environment/operations`: existing operation nodes plus industrial operations.
- `swarm/domain/manufacturing`: industrial digital twin models, simulator, stores, solver.
- `swarm/selector`: topology templates and graph selector implementations.
- `swarm/integrations/huawei`: Huawei Cloud, Ascend, Pangu, MindIE, and mock adapters.
- `swarm/persistence`: repository contracts and SQLite/GaussDB implementations.
- `backend`: FastAPI application and WebSocket dashboard stream.
- `frontend`: React/Vite dashboard.
- `scripts`: local demo, selector training, and A2C experiment scripts.
- `docs`: architecture, API, deployment, Huawei integration, and experiments.

# Architecture Boundaries

- Digital twin state belongs in `swarm/domain/manufacturing`.
- Agent reasoning belongs in `swarm/environment/agents/industrial`.
- Topology selection belongs in `swarm/selector`.
- Production scheduling constraints belong in the solver and validator, not in LLM prompts.
- Cloud services must be accessed only through adapter classes.
- Persistence must go through repository/store interfaces.

# Required Commands

- `C:\Anaconda\python.exe -m pytest -q`
- `C:\Anaconda\python.exe scripts/run_local_demo.py`
- `C:\Anaconda\python.exe scripts/generate_selector_dataset.py`
- `C:\Anaconda\python.exe scripts/train_graph_selector.py`
- `C:\Anaconda\python.exe scripts/evaluate_selector.py`
- `C:\Anaconda\python.exe scripts/run_a2c_experiment.py`
- `C:\Anaconda\python.exe scripts/export_topk_graphs.py`
- `cd frontend; npm install; npm run build`
- `docker compose up --build`

# Testing Rules

- Run focused tests after each milestone.
- Run the full test suite before final reporting.
- Record real failures and environment blockers.
- Do not report a command as passing unless it actually passed.

# Git Rules

- Run `git status` and `git diff --stat` after each milestone.
- Commit each milestone with the required message.
- Do not commit `.env` or real credentials.
- Do not revert user changes unless explicitly requested.

# Cloud Adapter Rules

- Default all Huawei, Pangu, MindIE, GaussDB, OBS, IoTDA, EventGrid, FunctionGraph, and ModelArts services to mock/local fallback mode.
- Never claim a real cloud connection unless an adapter actually connects with supplied credentials.
- Keep `.env.example` complete but empty of secrets.

# Security Rules

- No real API keys in code, tests, docs, or commits.
- Log only endpoint names and mock/connected state.
- Keep local SQLite and generated demo artifacts free of secrets.

# Milestone Rules

- Complete Milestones 0 through 10 in order.
- Each milestone must include implementation, tests or command checks, docs, `git status`, `git diff --stat`, and a commit.
- If an external system is unavailable, record the real error and continue with independent work.
