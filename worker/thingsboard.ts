import type { FinishEvent } from "../shared/sensor";

/*
 * ThingsBoard → FinishEvent.
 *
 * Everything that knows about the ThingsBoard payload lives in this file.
 *
 * The ESP32 finish gate (see the "ESP32 Makerspace Dashboard") reports one telemetry key per
 * sensor, `sensor<N>:detection_time` (which lane each sensor stops is set per activity). A rule-chain
 * "REST API Call" node forwards the telemetry message body, which is either flat or in
 * ThingsBoard's timestamped form, and may be batched in an array:
 *
 *   { "sensor3:detection_time": 1759680004210 }
 *   { "ts": 1759680004215, "values": { "sensor3:detection_time": 1759680004210 } }
 *
 * A value that looks like an epoch timestamp (ms) is used as the finish time. Anything else
 * (e.g. millis() since boot) can't be placed on our clock, so the arrival time is used instead.
 * Zero/empty values mean "nothing detected" and are skipped. The device may resend every key
 * on each report; the event id is derived from the value so repeats are dropped downstream.
 */

const SENSOR_KEY = /^sensor(\d+):detection_time$/;

/** Anything after 2001-09-09 in epoch ms; millis()-since-boot values are far smaller. */
const looksLikeEpochMs = (n: number) => n > 1e12;

export function toFinishEvents(body: unknown, receivedAt = Date.now()): FinishEvent[] {
  const messages = Array.isArray(body) ? body : [body];
  const events: FinishEvent[] = [];

  for (const m of messages) {
    if (!m || typeof m !== "object") continue;
    const values: Record<string, unknown> =
      "values" in m && m.values && typeof m.values === "object" ? m.values : m;
    const device =
      "deviceName" in m && typeof m.deviceName === "string" ? m.deviceName : "esp32";

    for (const [key, raw] of Object.entries(values)) {
      const match = SENSOR_KEY.exec(key);
      if (!match) continue;
      const sensor = Number(match[1]);
      const value = Number(raw);
      if (sensor < 1 || !Number.isFinite(value) || value <= 0) continue;

      events.push({
        id: `${device}:${sensor}:${value}`,
        sensor,
        at: looksLikeEpochMs(value) ? value : null,
        receivedAt,
        device,
      });
    }
  }
  return events;
}
