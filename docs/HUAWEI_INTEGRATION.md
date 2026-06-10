# Huawei Cloud Integration

The local default is mock/fallback mode. Runtime status is explicit:

- `mock`: no endpoint or credential is configured.
- `configured`: endpoint and credential are configured, but no successful runtime call has been observed yet.
- `connected`: the provider has completed a real HTTP call successfully during this process lifetime.
- `error`: a configured provider attempted a real HTTP call and failed.

## Environment

Copy `.env.example` and fill only local development values unless real Huawei credentials are available.

```text
LLM_PROVIDER=mock
DATABASE_PROVIDER=sqlite
EVENT_PROVIDER=local
OBJECT_STORAGE_PROVIDER=local
TRAINING_PROVIDER=local
```

For a real PanguLM API call:

```text
LLM_PROVIDER=pangu
PANGU_BASE_URL=https://your-pangu-endpoint
PANGU_API_KEY=your-secret-key
PANGU_AUTH_MODE=bearer
PANGU_MODEL=
PANGU_TEMPERATURE=0.2
PANGU_MAX_TOKENS=600
PANGU_TIMEOUT=20
```

`PANGU_AUTH_MODE` supports `bearer`, `apig`, and `token`, mapping to `Authorization`, `X-Apig-AppCode`, and `X-Auth-Token` respectively.

## Adapters

- `PanguChatProvider`: PanguLM chat adapter. Requires `PANGU_BASE_URL` and `PANGU_API_KEY`; performs a real HTTP request when `LLM_PROVIDER=pangu`.
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

## Runtime Status API

`GET /api/integrations/status`

Returns the dashboard status map used by the frontend, for example:

```json
{
  "status": {
    "PanguLM": "mock",
    "MindIE": "mock",
    "GaussDB": "sqlite fallback"
  }
}
```

Real credentials must be supplied through local environment variables only. Do not commit `.env` or any API key.
