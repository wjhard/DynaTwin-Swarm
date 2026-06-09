# Ascend and MindIE Deployment Notes

This project can run fully in local mock mode without Ascend hardware. For Ascend deployment, prepare the environment outside the repository and keep secrets in environment variables.

## Expected Components

- Ascend driver and firmware installed on the target host.
- CANN toolkit available to the MindIE runtime.
- MindIE inference service exposing an HTTP chat endpoint.
- Optional PanguLM-compatible endpoint for agent decisions.

## Configuration

```text
LLM_PROVIDER=mindie
MINDIE_BASE_URL=http://mindie-host:port/v1/chat/completions
```

For PanguLM:

```text
LLM_PROVIDER=pangu
PANGU_BASE_URL=https://pangu-endpoint.example/v1/chat/completions
PANGU_API_KEY=...
```

Never commit real API keys. Use `.env` locally and keep `.env.example` empty.

## Verification

Run the local mock demo first:

```powershell
C:\Anaconda\python.exe scripts/run_local_demo.py
```

Then point `MINDIE_BASE_URL` or `PANGU_BASE_URL` at the deployed service and run the backend. A response may be marked `connected` only when the adapter actually reaches the configured endpoint.
