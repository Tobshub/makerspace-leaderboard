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
      if (!env.INGEST_KEY) {
        log("error", "ingest.unconfigured", {});
        return text("INGEST_KEY is not configured", 500);
      }
      const key = req.headers.get("x-api-key") ?? url.searchParams.get("key") ?? "";
      if (!safeEqual(key, env.INGEST_KEY)) {
        log("warn", "ingest.unauthorized", { keyProvided: key !== "", ip: clientIp(req) });
        return text("Unauthorized", 401);
      }

      const raw = await req.text();
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        log("warn", "ingest.bad_json", { payload: clip(raw) });
        return text("Body must be JSON", 400);
      }
      const events = toFinishEvents(body);
      if (!events.length) {
        log("warn", "ingest.no_events", { payload: clip(raw) });
        return text("No finish events in payload", 422);
      }

      const result = await hub(env).publish(events);
      log("info", "ingest.ok", {
        payload: clip(raw),
        sensors: events.map((e) => e.sensor),
        ...result,
      });
      return Response.json({ accepted: events.length, ...result }, { status: 202 });
    }

    if (url.pathname === "/api/events") {
      if (req.headers.get("upgrade") !== "websocket") return text("Expected WebSocket", 426);
      log("info", "ws.connect", { ip: clientIp(req), ua: req.headers.get("user-agent") });
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

/** One structured line per event; shows up in `wrangler tail` and the dashboard's Workers Logs. */
function log(level: "info" | "warn" | "error", msg: string, fields: Record<string, unknown>) {
  console[level]({ msg, ...fields });
}

function clip(s: string, max = 500) {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function clientIp(req: Request) {
  return req.headers.get("cf-connecting-ip") ?? undefined;
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
    log("info", "ws.open", { clients: this.ctx.getWebSockets().length, replayed: recent.length });
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Returns counts so the ingest response and logs show what actually reached browsers. */
  async publish(events: FinishEvent[]) {
    const recent = (await this.ctx.storage.get<FinishEvent[]>("recent")) ?? [];
    // Devices may resend unchanged readings; only pass on ones we haven't seen.
    const known = new Set(recent.map((e) => e.id));
    const fresh = events.filter((e) => !known.has(e.id) && known.add(e.id));
    const sockets = this.ctx.getWebSockets();
    const result = { new: fresh.length, duplicates: events.length - fresh.length, clients: 0 };
    if (!fresh.length) return result;

    await this.ctx.storage.put("recent", [...recent, ...fresh].slice(-RECENT));
    const msg = JSON.stringify(fresh);
    for (const ws of sockets) {
      try {
        ws.send(msg);
        result.clients++;
      } catch {
        /* socket already closing */
      }
    }
    if (!result.clients) log("warn", "publish.no_clients", { sensors: fresh.map((e) => e.sensor) });
    return result;
  }

  async webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer) {
    if (msg === "ping") ws.send("pong");
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    ws.close(code, "closing");
    log("info", "ws.close", { code, reason, clients: this.ctx.getWebSockets().length - 1 });
  }

  async webSocketError(_ws: WebSocket, error: unknown) {
    log("warn", "ws.error", { error: String(error) });
  }
}
