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
