<h1 align="center">Molta</h1>
<h3 align="center">✨ Use MoltBot anywhere 🚀</h3>
<p align="center"><a href="./README.md">中文</a></p>

Molta is a lightweight HTTP gateway that forwards OpenAI-style `v1/chat/completions` requests to a local MoltBot (ClawdBot) gateway over WebSocket and returns compatible responses, so you can use MoltBot in existing clients.

## Features
- OpenAI-style endpoints: `/v1/chat/completions`, `/v1/models`
- Built-in auth: Bearer token via `TOKEN`
- Streaming responses (SSE)
- Session reuse + quick new-session command

## Quick Start
> Requires Node.js 20+ (for local dev or npm install)

### Option A: Install from npm
```bash
npm i -g molta
molta
```

### Option B: Run with Docker
```bash
docker run --rm -p 8090:8090 \
  -e TOKEN="<Your token>" \
  -e CLAWD_TOKEN="<Your Clawd Token>" \
  -e CLAWD_HOST="<Clawd host>" \
  -e CLAWD_PORT=<Clawd port> \
  ghcr.io/ve-ria/molta:latest
```

### Option C: Local development (Yarn 4.12.2)
```bash
yarn install
yarn dev
```

Default listening address: `http://127.0.0.1:8090`.

## Environment Variables
Molta reads `.env` in the current directory and validates it (see `schema.json`).

Required:
- `TOKEN`: HTTP auth token
- `CLAWD_TOKEN`: Clawd gateway auth token

Optional:
- `HOST`: bind host, default `localhost`
- `PORT`: bind port, default `8090`
- `CLAWD_HOST`: Clawd gateway host, default `localhost`
  - Both Molta and Clawd in Docker: use Clawd container name or IP
  - Molta in Docker, Clawd on host: use `host.docker.internal`
  - Both on host: use `localhost`
- `CLAWD_PORT`: Clawd gateway port, default `18789`

Example:
```bash
TOKEN="<Your token>"
HOST="127.0.0.1"
PORT=8090
CLAWD_HOST="127.0.0.1"
CLAWD_PORT=18789
CLAWD_TOKEN="<Your Clawd Token>"
```

## API
### List models
`GET /v1/models`

Example response (`created` is current time):
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

### Chat completions
`POST /v1/chat/completions`

Request body (OpenAI-compatible):
```json
{
  "model": "molta",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "stream": false
}
```

Auth:
```
Authorization: Bearer <TOKEN>
```

Streaming: set `stream=true` to receive SSE.

## Sessions
- Session ID is derived from `user` or `id` (falls back to `http`)
- Send `/clawd-new` or `clawd-new` to force a new session

## Run & Build (dev)
```bash
yarn build
yarn start
```

## Project Layout
- `src/router/chat/completions.ts`: main API logic
- `src/services/gateway.ts`: Clawd gateway WebSocket client
- `schema.json`: env validation schema
