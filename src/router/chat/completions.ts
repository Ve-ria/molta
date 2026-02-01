import { Elysia } from "elysia";
import { GatewayClient } from "../../services/gateway.js";
import { config } from "../../services/config.js";
import { expandRandomString, getOrCreateHttpChatId, renewHttpChatId } from "../../utils/random.js";
import { Readable } from "node:stream";

type ChatMessage = {
  role?: string;
  content?: unknown;
};

type ChatBody = {
  messages?: ChatMessage[];
  user?: string;
  id?: string;
  stream?: boolean;
};

function extractLastUserMessage(messages: unknown): string | null {
  if (!Array.isArray(messages)) return null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (!msg || typeof msg !== "object") continue;
    const role = (msg as ChatMessage).role;
    if (role !== "user") continue;
    const content = (msg as ChatMessage).content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      for (const item of content) {
        if (!item || typeof item !== "object") continue;
        const text = (item as { type?: string; text?: unknown }).text;
        if (typeof text === "string") return text;
      }
    }
  }
  return null;
}

function normalizeClientId(body: ChatBody): string {
  let clientId = typeof body.user === "string" ? body.user : "";
  if (!clientId.trim() && typeof body.id === "string") clientId = body.id;
  if (!clientId.trim()) clientId = "http";
  return expandRandomString(clientId.trim());
}

function getAuthToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const value = authorization.trim();
  if (!value) return null;
  if (value.toLowerCase().startsWith("bearer ")) return value.slice(7).trim();
  return value;
}

function createSseResponse(replyText: string, created: number) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const chunk = {
        id: `chatcmpl-clawd-${created}`,
        object: "chat.completion.chunk",
        created,
        model: "clawd",
        choices: [
          { index: 0, delta: { role: "assistant", content: replyText }, finish_reason: null },
        ],
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      const done = {
        id: `chatcmpl-clawd-${created}`,
        object: "chat.completion.chunk",
        created,
        model: "clawd",
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(done)}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function createSseStreamResponse(streamSource: AsyncIterable<string>, created: number) {
  const encoder = new TextEncoder();
  const nodeStream = Readable.from((async function* () {
    let sentRole = false;
    for await (const chunkText of streamSource) {
      if (!chunkText) continue;
      const delta: Record<string, string> = { content: chunkText };
      if (!sentRole) {
        delta.role = "assistant";
        sentRole = true;
      }
      const chunk = {
        id: `chatcmpl-clawd-${created}`,
        object: "chat.completion.chunk",
        created,
        model: "clawd",
        choices: [{ index: 0, delta, finish_reason: null }],
      };
      yield encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    const done = {
      id: `chatcmpl-clawd-${created}`,
      object: "chat.completion.chunk",
      created,
      model: "clawd",
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    };
    yield encoder.encode(`data: ${JSON.stringify(done)}\n\n`);
    yield encoder.encode("data: [DONE]\n\n");
  })());

  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;
  return new Response(webStream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export const completions = new Elysia()
  .use(config)
  .post("/v1/chat/completions", async ({ request, body, set, store }) => {
    const payload = (body && typeof body === "object"
      ? body
      : await request.json().catch(() => ({}))) as ChatBody;

    const token = store.config?.token as string | undefined;
    const authHeader = request.headers.get("authorization");
    const providedToken = getAuthToken(authHeader);
    if (token && (!providedToken || providedToken !== token)) {
      set.status = 401;
      return { error: { message: "Unauthorized" } };
    }

    const lastUser = extractLastUserMessage(payload.messages);
    if (!lastUser?.trim()) {
      set.status = 400;
      return { error: { message: "No user message found in 'messages'" } };
    }

    let clientId = normalizeClientId(payload);
    let replyText = "";

    if (lastUser.trim() === "/clawd-new" || lastUser.trim() === "clawd-new") {
      const newId = renewHttpChatId(clientId);
      replyText = `[ok] 已创建新会话：${newId}`;
    } else {
      const chatId = getOrCreateHttpChatId(clientId);
      const sessionKey = `openai:${chatId}`;
      const host = (store.config?.clawdHost as string | undefined) ?? "127.0.0.1";
      const port = Number(store.config?.clawdPort ?? 18789);
      const token = store.config?.clawdToken as string | undefined;
      const gateway = new GatewayClient(host, port, token);
      try {
        if (payload.stream) {
          const created = Math.floor(Date.now() / 1000);
          const source = gateway.askStream(lastUser, sessionKey);
          return createSseStreamResponse(source, created);
        }
        replyText = await gateway.ask(lastUser, sessionKey);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        set.status = 502;
        return { error: { message: `Gateway error: ${message}` } };
      }
    }

    const created = Math.floor(Date.now() / 1000);
    if (payload.stream) return createSseResponse(replyText, created);

    return {
      id: `chatcmpl-clawd-${created}`,
      object: "chat.completion",
      created,
      model: "clawd",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: replyText },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
  });
