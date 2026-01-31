<h1 align="center">Molta</h1>
<h3 align="center">✨ 在任意地方使用 MoltBot 🚀</h3>
<p align="center"><a href="./README.en.md">English</a></p>

Molta 是一个轻量的 HTTP 网关：将类 OpenAI 的 `v1/chat/completions` 请求转发到本地 MoltBot(ClawdBot) 网关（WebSocket），并返回兼容响应，方便你在现有客户端中直接使用 MoltBot(ClawdBot)。

## 特性
- OpenAI 风格接口：`/v1/chat/completions`、`/v1/models`
- 内置鉴权：使用 `TOKEN` 进行 Bearer 校验
- 支持流式响应（SSE）
- 会话复用与快速创建新会话指令

## 快速开始
> 需要 Node.js 20+（本地开发或 npm 安装时）

### 方式 A：从 npm 安装
```bash
npm i -g molta
molta
```

### 方式 B：Docker 运行
```bash
docker run --rm -p 8090:8090 \
  -e TOKEN="<Your token>" \
  -e CLAWD_TOKEN="<Your Clawd Token>" \
  -e CLAWD_HOST="<Clawd host>" \
  -e CLAWD_PORT=<Clawd port> \
  ghcr.io/ve-ria/molta:latest
```

### 方式 C：本地开发（Yarn 4.12.0）
```bash
yarn install
yarn dev
```

启动后默认监听 `http://127.0.0.1:8090`。

## 环境变量
项目会读取当前目录的 `.env` 并校验（见 `schema.json`）。

必填：
- `TOKEN`：HTTP 接口鉴权 Token
- `CLAWD_TOKEN`：Clawd 网关鉴权 Token

可选：
- `HOST`：监听地址，默认 `localhost`
- `PORT`：监听端口，默认 `8090`
- `CLAWD_HOST`：Clawd 网关地址，默认 `localhost`
  - Molta 与 Clawd 都在 Docker：填 Clawd 容器名或容器 IP
  - Molta 在 Docker、Clawd 在本机：填 `host.docker.internal`
  - Molta 与 Clawd 都在本机：填 `localhost`
- `CLAWD_PORT`：Clawd 网关端口，默认 `18789`

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
  "model": "molta",
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

## 运行与构建（开发者）
```bash
yarn build
yarn start
```

## SEA 打包（单文件可执行）
> 需要 Node.js 20+（推荐 22+）

```bash
yarn build:sea
```

产物位于 `dist/molta-sea`（Windows 可自行加 `.exe`），中间产物在 `dist-sea/`。

## 目录结构
- `src/router/chat/completions.ts`：主接口逻辑
- `src/services/gateway.ts`：Clawd 网关 WebSocket 客户端
- `schema.json`：环境变量校验规则
