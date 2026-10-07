import type { FinishEvent } from "../shared/sensor";

/*
 * ThingsBoard → FinishEvent.
 *
 * The payload shape isn't final yet, so everything that knows about it lives in this file.
 * Assumed shape: a rule-chain "REST API Call" node posting either one message or an array of them:
 *
 *   {
 *     "deviceName": "finish-gate-1",
 *     "ts": 1759680000000,                       // when the sensor fired (epoch ms), optional
 *     "telemetry": { "lane": 3, "triggered": true }
 *   }
 *
 * Messages with `triggered: false` or without a valid lane are ignored.
 */

interface ThingsBoardMessage {
  deviceName?: unknown;
  ts?: unknown;
  telemetry?: { lane?: unknown; triggered?: unknown };
}

export function toFinishEvents(body: unknown, receivedAt = Date.now()): FinishEvent[] {
  const messages = (Array.isArray(body) ? body : [body]) as ThingsBoardMessage[];
  const events: FinishEvent[] = [];

  for (const m of messages) {
    if (!m || typeof m !== "object" || !m.telemetry) continue;
    const lane = Number(m.telemetry.lane);
    if (!Number.isInteger(lane) || lane < 1) continue;
    if (m.telemetry.triggered === false) continue;

    const ts = Number(m.ts);
    const at = Number.isFinite(ts) && ts > 0 ? ts : null;
    const device = typeof m.deviceName === "string" ? m.deviceName : "unknown";

    events.push({
      id: at ? `${device}:${lane}:${at}` : crypto.randomUUID(),
      lane,
      at,
      receivedAt,
      device,
    });
  }
  return events;
}
