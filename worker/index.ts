import { DurableObject } from "cloudflare:workers";
import type { FinishEvent } from "../shared/sensor";
import { toFinishEvents } from "./thingsboard";

/*
 * Routes (everything else falls through to the static app):
 *   POST /api/thingsboard   ingest sensor data; needs `x-api-key: <INGEST_KEY>` (or ?key=)
 *   GET  /api/events        WebSocket; streams FinishEvent JSON to the browser
 */

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname === "/api/thingsboard") {
      if (req.method !== "POST") return text("Method not allowed", 405);
      if (!env.INGEST_KEY) return text("INGEST_KEY is not configured", 500);
      const key = req.headers.get("x-api-key") ?? url.searchParams.get("key") ?? "";
      if (!safeEqual(key, env.INGEST_KEY)) return text("Unauthorized", 401);

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return text("Body must be JSON", 400);
      }
      const events = toFinishEvents(body);
      if (!events.length) return text("No finish events in payload", 422);

      await hub(env).publish(events);
      return Response.json({ accepted: events.length }, { status: 202 });
    }

    if (url.pathname === "/api/events") {
      if (req.headers.get("upgrade") !== "websocket") return text("Expected WebSocket", 426);
      return hub(env).fetch(req);
    }

    if (url.pathname.startsWith("/api/")) return text("Not found", 404);
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;

function hub(env: Env) {
  return env.SENSOR_HUB.get(env.SENSOR_HUB.idFromName("default"));
}

function text(body: string, status: number) {
  return new Response(body, { status });
}

function safeEqual(a: string, b: string) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  return x.byteLength === y.byteLength && crypto.subtle.timingSafeEqual(x, y);
}

/** How many recent events to replay to a client that (re)connects mid-race. */
const RECENT = 50;

/**
 * One hub fans events out to every connected browser. Recent events are kept so a tab
 * that reconnects mid-race catches up; clients ignore anything from before their race started.
 */
export class SensorHub extends DurableObject<Env> {
  async fetch() {
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    const recent = (await this.ctx.storage.get<FinishEvent[]>("recent")) ?? [];
    if (recent.length) server.send(JSON.stringify(recent));
    return new Response(null, { status: 101, webSocket: client });
  }

  async publish(events: FinishEvent[]) {
    const recent = (await this.ctx.storage.get<FinishEvent[]>("recent")) ?? [];
    // Devices may resend unchanged readings; only pass on ones we haven't seen.
    const known = new Set(recent.map((e) => e.id));
    const fresh = events.filter((e) => !known.has(e.id) && known.add(e.id));
    if (!fresh.length) return;
    await this.ctx.storage.put("recent", [...recent, ...fresh].slice(-RECENT));
    const msg = JSON.stringify(fresh);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(msg);
      } catch {
        /* socket already closing */
      }
    }
  }

  async webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer) {
    if (msg === "ping") ws.send("pong");
  }

  async webSocketClose(ws: WebSocket, code: number) {
    ws.close(code, "closing");
  }
}
