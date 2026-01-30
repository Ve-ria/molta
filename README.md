<h1 align="center">Molta</h1>
<h3 align="center">✨ 在任意地方使用 MoltBot 🚀</h3>

Molta 是一个轻量的 HTTP 网关：将类 OpenAI 的 `v1/chat/completions` 请求转发到本地 Clawd 网关（WebSocket），并返回兼容响应，方便你在现有客户端中直接使用 MoltBot。

## 特性
- OpenAI 风格接口：`/v1/chat/completions`、`/v1/models`
- 内置鉴权：使用 `TOKEN` 进行 Bearer 校验
- 支持流式响应（SSE）
- 会话复用与快速创建新会话指令

## 快速开始
> 需要 Node.js 20+ 与 pnpm

```bash
pnpm install
pnpm dev
```

启动后默认监听 `http://127.0.0.1:8090`。

## 环境变量
项目会读取 `.env` 并校验（见 `schema.json`）。

必填：
- `TOKEN`：HTTP 接口鉴权 Token
- `CLAWD_TOKEN`：Clawd 网关鉴权 Token

可选：
- `HOST`：监听地址，默认 `localhost`
- `PORT`：监听端口，默认 `8090`
- `CLAWD_HOST`：Clawd 网关地址，默认 `localhost`，
  - 如您使用 Docker 部署 MoltBot(Clawd) 以及 Molta，请设置为`<Clawd Container ID>`，
  - 如您使用可执行文件部署 MoltBot(Clawd) 以及 Molta，请设置为`localhost`(如果使用 Docker 部署 MoltBot(Clawd) 但使用可执行文件部署 Molta 也同样设置为此 HOST)
  - 如您使用 Docker 部署 Molta 但使用可执行文件部署 MoltBot(Clawd)，请设置为`host.docker.internal`
- `CLAWD_PORT`：Clawd 网关端口，默认 `18789`
- `CLAWD_AGENT_ID`：预留字段（当前实现中未使用）

示例：
```bash
TOKEN="<Your token>"
HOST="127.0.0.1"
PORT=8090
CLAWD_HOST="127.0.0.1"
CLAWD_PORT=18789
CLAWD_TOKEN="<Your Clawd Token>"
```

## 接口
### 获取模型列表
`GET /v1/models`

示例返回（`created` 为当前时间）：
```json
{
  "object": "list",
  "data": [
    {
      "id": "molta",
      "object": "model",
      "created": "2025-01-01T00:00:00.000Z",
      "owned_by": "molta"
    }
  ]
}
```

### 聊天补全
`POST /v1/chat/completions`

请求体（兼容 OpenAI）：
```json
{
  "model": "clawd",
  "messages": [
    { "role": "user", "content": "你好" }
  ],
  "stream": false
}
```

鉴权：
```
Authorization: Bearer <TOKEN>
```

流式响应：当 `stream=true` 时返回 SSE。

## 会话说明
- 会话 ID 基于 `user` 或 `id` 字段生成；未提供则使用 `http`。
- 发送 `/clawd-new` 或 `clawd-new` 可强制创建新会话。

## 运行与构建
```bash
pnpm build
pnpm start
```

打包可执行文件（多平台）：
```bash
pnpm package
```

## 目录结构
- `src/router/chat/completions.ts`：主接口逻辑
- `src/services/gateway.ts`：Clawd 网关 WebSocket 客户端
- `schema.json`：环境变量校验规则
