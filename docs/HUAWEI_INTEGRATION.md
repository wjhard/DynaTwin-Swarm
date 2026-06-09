# Huawei Cloud Integration

The local default is mock/fallback mode. No adapter reports `connected` unless the required endpoint or credentials are present.

## Environment

Copy `.env.example` and fill only local development values unless real Huawei credentials are available.

```text
LLM_PROVIDER=mock
DATABASE_PROVIDER=sqlite
EVENT_PROVIDER=local
OBJECT_STORAGE_PROVIDER=local
TRAINING_PROVIDER=local
```

## Adapters

- `PanguChatProvider`: PanguLM chat adapter. Requires `PANGU_BASE_URL` and `PANGU_API_KEY`.
- `MindIEChatProvider`: MindIE inference adapter. Requires `MINDIE_BASE_URL`.
- `GaussDBRepository`: Repository contract with SQLite fallback when `GAUSSDB_DSN` is absent.
- `OBSClient`: stores objects locally when `OBS_BUCKET` is absent.
- `IoTDAClient`: records local event-bus messages when `IOTDA_ENDPOINT` is absent.
- `EventGridHandler`: routes events locally when `EVENTGRID_ENDPOINT` is absent.
- `FunctionGraphHandler`: triggers local callbacks when `FUNCTIONGRAPH_ENDPOINT` is absent.
- `ModelArtsClient`: records local training jobs when `MODELARTS_ENDPOINT` is absent.

## Local Demo Chain

```text
Factory Simulator -> Local Event Bus -> FastAPI -> DynaTwin-Swarm -> SQLite -> Dashboard
```

## Huawei Chain

```text
Device / Simulator -> MQTT -> IoTDA -> EventGrid -> FunctionGraph -> FastAPI
```

The code contains adapter boundaries for this path, but this repository does not include real Huawei credentials.
