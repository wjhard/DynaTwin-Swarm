# DynaTwin-Swarm API

## Health

`GET /health`

Returns local service status.

## Task Execution

`POST /api/tasks/run`

Request:

```json
{"scenario": "main"}
```

Response includes:

- `task_id`
- `task_profile`
- `selected_topology`
- `agent_traces`
- `best_plan`
- `alternative_plans`
- `risk_summary`
- `metrics`

## Public Datasets

`GET /api/datasets/public`

Returns public benchmark datasets currently available to the dashboard. The first integrated dataset is `jsplib_ft06`, a classic public 6-machine, 6-job Job Shop Scheduling benchmark distributed through JSPLib / OR-Library collections.

The dashboard also includes larger public benchmark instances downloaded from the ScheduleOpt public Job Shop benchmark mirror:

- `la40`: Lawrence 15-machine, 15-job instance, 225 operations.
- `abz9`: Adams-Balas-Zawack 15-machine, 20-job instance, 300 operations.
- `swv20`: Storer-Wu-Vaccari 10-machine, 50-job instance, 500 operations.
- `dmu80`: Demirkol-Mehta-Uzsoy 20-machine, 50-job instance, 1000 operations.

Large instances are converted into the same industrial `FactoryState` model as the local digital-twin scenarios, so the pipeline remains:

```text
public benchmark -> FactoryState -> large-scale task profile -> Graph Selector -> ReflAct agents -> CP-SAT scheduler -> dashboard
```

`POST /api/datasets/public/{dataset_id}/run`

Runs a public benchmark through the same DynaTwin-Swarm pipeline:

```text
dataset -> FactoryState -> Graph Selector -> ReflAct agents -> scheduler -> dashboard
```

Example:

```text
POST /api/datasets/public/jsplib_ft06/run
POST /api/datasets/public/abz9/run
POST /api/datasets/public/dmu80/run
```

The response shape matches `POST /api/tasks/run`.

## Events

`POST /api/events/machine-alert`

```json
{"machine_id": "M3"}
```

`POST /api/events/order-created`

```json
{"order_id": "O4"}
```

## Dashboard Reads

- `GET /api/state`
- `GET /api/schedules/latest`
- `GET /api/traces/latest`
- `GET /api/topology/latest`
- `GET /api/events/latest`
- `GET /api/experiments/latest`

## WebSocket

`WS /ws/dashboard`

Sends one dashboard snapshot with latest state, execution record, and recent events.
