# 盘古大模型真实 API 接入说明

## 1. 为什么要做这一步

当前 DynaTwin-Swarm 可以在本地 mock 模式下完整运行，但评审或答辩时，如果系统能真实调用盘古大模型 API，会比单纯 mock 更有说服力。

这一步的价值是：

- 让 ReflAct Agent 的决策说明由真实大模型生成，而不是只靠规则文本。
- 前端状态栏可以从 `PanguLM: mock` 变成 `PanguLM: configured` 或 `PanguLM: connected`。
- 保留本地 fallback，避免没有 Key 或网络异常时系统完全不可用。
- 不提交任何真实密钥，保证安全。

## 2. 当前实现状态

项目已经预留并实现了真实 HTTP 调用骨架：

```text
swarm/integrations/huawei/providers.py
swarm/llm/industrial_provider.py
backend/main.py
frontend/src/main.tsx
```

实现逻辑如下：

```text
没有 PANGU_BASE_URL / PANGU_API_KEY
  -> PanguLM: mock
  -> Agent 使用本地 fallback 文本

配置了 PANGU_BASE_URL / PANGU_API_KEY，但还没有成功调用
  -> PanguLM: configured
  -> 说明系统已经准备调用真实 API

真实 HTTP 调用成功
  -> PanguLM: connected
  -> Agent evidence 中展示盘古返回的推理/建议文本

真实 HTTP 调用失败
  -> PanguLM: error
  -> 系统回退到安全 fallback，不会崩溃
```

这样做的原则是：不伪造真实连接状态。

## 3. 需要准备什么

你需要从华为云控制台获得：

- 盘古大模型 API 访问地址。
- API Key、AppCode 或 Token。
- 如果接口要求模型名，还需要模型 ID 或模型名称。

通常流程是：

```text
注册华为云账号
  -> 进入 ModelArts Studio 或盘古大模型相关控制台
  -> 申请模型 API 调用权限
  -> 获取 endpoint 和鉴权信息
  -> 配置到本项目环境变量
```

具体入口和字段名可能会随华为云控制台更新而变化，最终以你账号后台显示的 API 文档为准。

## 4. 环境变量配置

项目根目录有：

```text
.env.example
```

可以复制成：

```text
.env
```

然后填写：

```text
LLM_PROVIDER=pangu
PANGU_BASE_URL=https://你的盘古API地址
PANGU_API_KEY=你的API密钥
PANGU_AUTH_MODE=bearer
PANGU_MODEL=
PANGU_TEMPERATURE=0.2
PANGU_MAX_TOKENS=600
PANGU_TIMEOUT=20
PANGU_NO_THINK=false
```

不要把真实 `.env` 提交到 Git。

## 5. 鉴权模式说明

当前 `PanguChatProvider` 支持三种鉴权头：

| `PANGU_AUTH_MODE` | 请求头 | 适用情况 |
| --- | --- | --- |
| `bearer` | `Authorization: Bearer <key>` | 常见大模型 API Key |
| `apig` | `X-Apig-AppCode: <key>` | API Gateway AppCode |
| `token` | `X-Auth-Token: <key>` | Token 鉴权 |

如果你的华为云文档要求 `Authorization: Bearer xxx`，使用：

```text
PANGU_AUTH_MODE=bearer
```

如果要求 `X-Apig-AppCode`，使用：

```text
PANGU_AUTH_MODE=apig
```

如果要求 `X-Auth-Token`，使用：

```text
PANGU_AUTH_MODE=token
```

## 6. PyCharm 后端配置方式

打开后端运行配置 `DynaTwin Backend`，在 `Environment variables` 里加入：

```text
PYTHONUNBUFFERED=1;APP_ENV=local;LLM_PROVIDER=pangu;SQLITE_PATH=./data/dynatwin.db;PANGU_BASE_URL=https://你的盘古API地址;PANGU_API_KEY=你的API密钥;PANGU_AUTH_MODE=bearer;PANGU_MODEL=;PANGU_TEMPERATURE=0.2;PANGU_MAX_TOKENS=600;PANGU_TIMEOUT=20
```

如果 Key 很长，建议不要截图，不要发给别人，不要写进文档。

## 7. 启动后如何验证

启动后端：

```powershell
C:\Anaconda\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8010 --reload
```

检查集成状态：

```text
http://127.0.0.1:8010/api/integrations/status
```

没有配置时：

```json
{
  "status": {
    "PanguLM": "mock"
  }
}
```

配置了 Key 但还未成功调用时：

```json
{
  "status": {
    "PanguLM": "configured"
  }
}
```

调用 `/api/tasks/run` 且盘古接口成功返回后：

```json
{
  "status": {
    "PanguLM": "connected"
  }
}
```

如果请求失败：

```json
{
  "status": {
    "PanguLM": "error"
  }
}
```

## 8. 前端显示效果

前端顶部状态栏会自动读取：

```text
GET /api/integrations/status
```

因此会显示：

```text
PanguLM: mock
```

或：

```text
PanguLM: configured
```

或：

```text
PanguLM: connected
```

Agent 决策卡片中也会显示 provider evidence。接入盘古后，这里会出现盘古生成的中文决策说明。

## 9. ReflAct Agent 如何调用盘古

当：

```text
LLM_PROVIDER=pangu
```

每个工业 Agent 会构造一个简洁提示词，包含：

- Agent 名称。
- 当前任务类型。
- 风险等级。
- 当前拓扑。
- 机器数量。
- 故障机器。
- 高温机器。
- 紧急订单。
- 告警数量。
- 库存短缺数量。
- 资源冲突数量。
- 最近事件。

然后通过 `PanguChatProvider` 调用真实 HTTP API。

返回文本会作为 Agent 的 evidence，展示在前端 `ReflAct Decisions` 中。

## 10. 安全注意事项

必须遵守：

- 不要把真实 API Key 写进代码。
- 不要提交 `.env`。
- 不要在截图中暴露 Key。
- 不要把 Key 写进 README 或论文附件。
- 如果调试报错，不要把完整请求头发给别人。

当前项目只提交 `.env.example`，里面没有任何真实密钥。

## 11. 如果调用失败怎么办

常见原因：

| 问题 | 处理 |
| --- | --- |
| 401 / 403 | API Key、Token 或鉴权头类型不对 |
| 404 | `PANGU_BASE_URL` 填错 |
| 429 | 调用额度或频率限制 |
| timeout | 网络、代理或 endpoint 不可达 |
| JSON 解析失败 | 接口返回格式与当前解析器不一致，需要适配 response schema |

失败时系统不会崩溃，而是：

```text
PanguLM: error
Agent 使用 fallback
前端仍可继续运行
```

## 12. 下一步可以继续优化

接入真实盘古 API 后，建议继续做：

- 把 Agent 的 `recommended_action` 也改为大模型结构化输出。
- 要求盘古返回严格 JSON，字段包括 observe、reflect、act、risk、confidence。
- 增加 prompt 模板管理。
- 增加每个 Agent 的 token、耗时、调用状态统计。
- 增加 OpenTelemetry trace。
- 增加“盘古返回内容 vs 规则 fallback”的对比面板。

## 13. 展示时可以怎么说

可以这样讲：

```text
当前系统默认支持本地 mock 模式，保证没有云账号时也能完整演示。
当配置华为云盘古大模型 API 后，工业 ReflAct Agent 会真实调用盘古生成决策说明。
系统不会伪造连接状态：未配置显示 mock，已配置显示 configured，真实调用成功后显示 connected。
这样既保证了演示稳定性，也保留了真实华为云大模型接入能力。
```
