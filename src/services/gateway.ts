import os from "os";

export class GatewayClient {
    host: string;
    port: number;
    token: string;
    platform: string;
    constructor(host: string, port: number, token: string) {
        this.host = host;
        this.port = port;
        this.token = token;
        this.platform = os.platform()
    }

    async ask(prompt: string, session?: string): Promise<string> {
        return await (new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://${this.host}:${this.port}`);
            let buf = "";
            let run_id: string | null = null;
            let settled = false;
            const timeout = setTimeout(() => {
                if (settled) return;
                settled = true;
                ws.close();
                reject(new Error("gateway timeout"));
            }, 60_000);

            const finalizeResolve = (value: string) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                resolve(value);
                ws.close();
            };

            const finalizeReject = (err: Error) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                reject(err);
                ws.close();
            };
            ws.onmessage = ({ data }) => {
                let obj: any;
                try {
                    obj = JSON.parse(data as string);
                } catch (error) {
                    finalizeReject(error instanceof Error ? error : new Error("invalid gateway payload"));
                    return;
                }
                if (obj.type === "event" && obj.event === "connect.challenge") {
                    ws.send(
                        JSON.stringify(
                            {
                                "type": "req",
                                "id": "connect",
                                "method": "connect",
                                "params": {
                                    "minProtocol": 3,
                                    "maxProtocol": 3,
                                    "client": {
                                        "id": "gateway-client",
                                        "version": "0.1.0",
                                        "platform": this.platform,
                                        "mode": "backend",
                                    },
                                    "role": "operator",
                                    "scopes": ["operator.read", "operator.write"],
                                    "auth": { "token": this.token },
                                    "locale": "zh-CN",
                                    "userAgent": "openai-clawdbot-bridge",
                                },
                            }
                        )
                    )
                    return;
                }

                if (obj["type"] === "res" && obj["id"] === "connect") {
                    if (!(obj["ok"])) {
                        finalizeReject(new Error((obj["error"] || {})["message"] || "connect failed"));
                        return;
                    }
                    ws.send(JSON.stringify(
                        {
                            "type": "req",
                            "id": "agent",
                            "method": "agent",
                            "params": {
                                "message": prompt,
                                "agentId": "main",
                                "sessionKey": session,
                                "deliver": false,
                                "idempotencyKey": crypto.randomUUID(),
                            },
                        }
                    ))
                    return;
                }

                if (obj["type"] === "res" && obj["id"] === "agent") {
                    if (!(obj["ok"])) {
                        finalizeReject(new Error((obj["error"] ?? {})["message"] || "agent failed"));
                        return;
                    }
                    const payload = obj["payload"] || {};
                    if (payload["runId"]) {
                        run_id = payload["runId"];
                    }
                    return;
                }

                if (obj["type"] === "event" && obj["event"] === "agent") {
                    const payload = obj["payload"] || {};
                    if (payload["runId"] !== run_id) return;

                    if (payload["stream"] === "assistant") {
                        const data = payload["data"] || {};
                        if (typeof data["text"] === "string") buf = data["text"];
                    } else if (typeof payload["delta"] === "string") buf += payload["delta"];

                    if (payload["stream"] === "lifecycle") {
                        const phase = (payload["data"] || {})["phase"];
                        if (phase === "end") {
                            finalizeResolve(buf.trim());
                        } else if (phase === "error") {
                            finalizeReject(new Error((payload["data"] || {})["message"] || "agent failed"));
                        }
                    }
                }
            }

            ws.onerror = () => {
                const detail = ws.readyState === WebSocket.CLOSED ? "closed" : `state:${ws.readyState}`;
                finalizeReject(new Error(`gateway websocket error (${detail}) url=${ws.url}`));
            };
            ws.onclose = (event) => {
                if (settled) return;
                if (event.wasClean || buf.trim()) {
                    finalizeResolve(buf.trim());
                    return;
                }
                const reason = event.reason ? ` reason=${event.reason}` : "";
                finalizeReject(new Error(`gateway websocket closed code=${event.code}${reason} url=${ws.url}`));
            };
        }))
    }

    async *askStream(prompt: string, session?: string): AsyncGenerator<string> {
        const queue: string[] = [];
        let done = false;
        let error: Error | null = null;
        let notify: (() => void) | null = null;

        const push = (value: string) => {
            if (!value) return;
            queue.push(value);
            if (notify) {
                notify();
                notify = null;
            }
        };

        const finish = () => {
            done = true;
            if (notify) {
                notify();
                notify = null;
            }
        };

        const fail = (err: Error) => {
            error = err;
            done = true;
            if (notify) {
                notify();
                notify = null;
            }
        };

        const ws = new WebSocket(`ws://${this.host}:${this.port}`);
        let run_id: string | null = null;
        let settled = false;
        let lastAssistant = "";

        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            ws.close();
            fail(new Error("gateway timeout"));
        }, 60_000);

        const finalize = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            ws.close();
            finish();
        };

        const finalizeReject = (err: Error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            ws.close();
            fail(err);
        };

        ws.onmessage = ({ data }) => {
            let obj: any;
            try {
                obj = JSON.parse(data as string);
            } catch (err) {
                finalizeReject(err instanceof Error ? err : new Error("invalid gateway payload"));
                return;
            }
            if (obj.type === "event" && obj.event === "connect.challenge") {
                ws.send(
                    JSON.stringify(
                        {
                            "type": "req",
                            "id": "connect",
                            "method": "connect",
                            "params": {
                                "minProtocol": 3,
                                "maxProtocol": 3,
                                "client": {
                                    "id": "gateway-client",
                                    "version": "0.1.0",
                                    "platform": this.platform,
                                    "mode": "backend",
                                },
                                "role": "operator",
                                "scopes": ["operator.read", "operator.write"],
                                "auth": { "token": this.token },
                                "locale": "zh-CN",
                                "userAgent": "openai-clawdbot-bridge",
                            },
                        }
                    )
                );
                return;
            }

            if (obj["type"] === "res" && obj["id"] === "connect") {
                if (!(obj["ok"])) {
                    finalizeReject(new Error((obj["error"] || {})["message"] || "connect failed"));
                    return;
                }
                ws.send(JSON.stringify(
                    {
                        "type": "req",
                        "id": "agent",
                        "method": "agent",
                        "params": {
                            "message": prompt,
                            "agentId": "main",
                            "sessionKey": session,
                            "deliver": false,
                            "idempotencyKey": crypto.randomUUID(),
                        },
                    }
                ));
                return;
            }

            if (obj["type"] === "res" && obj["id"] === "agent") {
                if (!(obj["ok"])) {
                    finalizeReject(new Error((obj["error"] ?? {})["message"] || "agent failed"));
                    return;
                }
                const payload = obj["payload"] || {};
                if (payload["runId"]) {
                    run_id = payload["runId"];
                }
                return;
            }

            if (obj["type"] === "event" && obj["event"] === "agent") {
                const payload = obj["payload"] || {};
                if (payload["runId"] !== run_id) return;

                if (payload["stream"] === "assistant") {
                    const data = payload["data"] || {};
                    if (typeof data["text"] === "string") {
                        const text = data["text"];
                        let delta = text;
                        if (text.startsWith(lastAssistant)) {
                            delta = text.slice(lastAssistant.length);
                        }
                        lastAssistant = text;
                        push(delta);
                    }
                } else if (typeof payload["delta"] === "string") {
                    push(payload["delta"]);
                }

                if (payload["stream"] === "lifecycle") {
                    const phase = (payload["data"] || {})["phase"];
                    if (phase === "end") {
                        finalize();
                    } else if (phase === "error") {
                        finalizeReject(new Error((payload["data"] || {})["message"] || "agent failed"));
                    }
                }
            }
        };

        ws.onerror = () => {
            const detail = ws.readyState === WebSocket.CLOSED ? "closed" : `state:${ws.readyState}`;
            finalizeReject(new Error(`gateway websocket error (${detail}) url=${ws.url}`));
        };
        ws.onclose = (event) => {
            if (settled) return;
            if (event.wasClean) {
                finalize();
                return;
            }
            const reason = event.reason ? ` reason=${event.reason}` : "";
            finalizeReject(new Error(`gateway websocket closed code=${event.code}${reason} url=${ws.url}`));
        };

        try {
            while (true) {
                if (queue.length) {
                    yield queue.shift() as string;
                    continue;
                }
                if (done) {
                    if (error) throw error;
                    return;
                }
                await new Promise<void>((resolve) => {
                    notify = resolve;
                });
            }
        } finally {
            if (!settled) {
                settled = true;
                clearTimeout(timeout);
                ws.close();
            }
        }
    }
}
