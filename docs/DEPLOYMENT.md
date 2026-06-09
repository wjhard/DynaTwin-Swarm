# Deployment

## Local Backend

```powershell
C:\Anaconda\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8010
```

## Local Frontend

```powershell
cd frontend
$env:VITE_API_TARGET="http://127.0.0.1:8010"
npm run dev -- --port 5174
```

## Docker

```powershell
docker compose up --build
```

The compose file builds a Python FastAPI backend and a static Nginx frontend. Local mock mode is the default.
