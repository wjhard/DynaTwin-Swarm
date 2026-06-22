# 豆包大模型接入说明

DynaTwin-Swarm 已支持将豆包作为工业 Agent 的大模型 Provider。接入方式走火山方舟 OpenAI-compatible Chat Completions API；没有密钥或模型 ID 时会自动回退到本地 mock，不会影响本地 Demo。

## 环境变量

```powershell
LLM_PROVIDER=doubao
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
DOUBAO_API_KEY=你的火山方舟API Key
DOUBAO_MODEL=你的豆包模型Endpoint或模型ID
DOUBAO_TEMPERATURE=0.2
DOUBAO_MAX_TOKENS=600
DOUBAO_TIMEOUT=20
DOUBAO_NO_THINK=true
```

## PyCharm 后端运行配置

在后端运行配置中使用：

```powershell
C:\Anaconda\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8010 --reload
```

环境变量示例：

```text
PYTHONUNBUFFERED=1;APP_ENV=local;LLM_PROVIDER=doubao;SQLITE_PATH=./data/dynatwin.db;DOUBAO_API_KEY=你的Key;DOUBAO_MODEL=你的模型Endpoint
```

## 验证方式

启动后端后访问：

```text
http://127.0.0.1:8010/api/integrations/status
```

未配置密钥时会看到：

```json
{"Doubao": "mock"}
```

配置密钥和模型后会看到：

```json
{"Doubao": "configured"}
```

当某次 Agent 调度真实调用成功后，运行时状态会更新为：

```json
{"Doubao": "connected"}
```

如果真实 HTTP 调用失败，状态会显示为 `error`，Agent 决策 evidence 中会保留 fallback 信息，但系统不会中断。

## 代码位置

- `swarm/integrations/doubao/providers.py`：豆包 HTTP Chat Provider。
- `swarm/llm/industrial_provider.py`：将 `LLM_PROVIDER=doubao` 接入工业 Agent。
- `.env.example`：豆包相关环境变量模板。
