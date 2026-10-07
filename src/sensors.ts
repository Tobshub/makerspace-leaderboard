import { useSyncExternalStore } from "react";
import type { FinishEvent } from "../shared/sensor";
import { fmt, laneForSensor } from "./logic";
import { getActivities, stopTeam } from "./store";
import { STAGE_LABEL } from "./types";

/*
 * Live feed of finish-line triggers from the server (see worker/). Every operator tab applies
 * each event to the running race; the store ignores a stop for a lane that's already stopped,
 * so several open tabs are harmless. The audience display only listens for connection status.
 */

export type SensorStatus = "connecting" | "online" | "offline";

let status: SensorStatus = "connecting";
const listeners = new Set<() => void>();
const seen = new Set<string>();

/** Console logs for the feed, filterable by "[sensors]" in devtools. */
const log = {
  info: (...args: unknown[]) => console.info("%c[sensors]", "color:#8b5cf6", ...args),
  warn: (...args: unknown[]) => console.warn("[sensors]", ...args),
};

function setStatus(s: SensorStatus) {
  if (s !== status) log.info(`status: ${status} → ${s}`);
  status = s;
  listeners.forEach((l) => l());
}

export function useSensorStatus() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => status
  );
}

/**
 * Turn an event into a stop. The activity's sensor map picks the lane, and lane N is the Nth
 * team of whichever race is running (the most recently started one if, unusually, several are).
 * The sensor's own timestamp is used when it's plausible for this race; otherwise the time it
 * reached the server.
 */
function apply(ev: FinishEvent) {
  if (seen.has(ev.id)) return;
  seen.add(ev.id);
  if (!Number.isInteger(ev.sensor)) return log.warn("dropped event in an unknown format", ev);
  const tag = `sensor ${ev.sensor} (${ev.device})`;
  const skip = (why: string) => log.info(`ignored ${tag}: ${why}`, ev);

  if (location.hash.startsWith("#/display")) return skip("audience display doesn't apply stops");

  const running = getActivities()
    .flatMap((a) => Object.values(a.stages).map((s) => ({ a, s })))
    .filter(({ s }) => s.status === "running" && s.startedAt != null)
    .sort((x, y) => y.s.startedAt! - x.s.startedAt!)[0];
  if (!running) return skip("no race running");

  const { a, s } = running;
  const startedAt = s.startedAt!;
  const lane = laneForSensor(a.settings, ev.sensor);
  if (lane == null) return skip(`switched off for ${a.name}`);
  const team = s.teams[lane - 1];
  if (!team) return skip(`mapped to lane ${lane}, but the race only has ${s.teams.length} lanes`);
  const entry = s.entries.find((e) => e.teamId === team.id);
  if (entry?.dnf) return skip(`${team.name} is already DNF`);
  if (entry?.finishMs != null) return skip(`${team.name} already stopped at ${fmt(entry.finishMs)}`);

  // Prefer the sensor's own timestamp; fall back to when it reached the server.
  const now = Date.now();
  let at: number;
  let clock: string;
  if (ev.at != null && ev.at <= now + 1000) {
    if (ev.at < startedAt) return skip(`fired ${fmt(startedAt - ev.at)} before the start`);
    at = Math.min(ev.at, now);
    clock = "sensor timestamp";
  } else {
    if (ev.at != null) log.warn(`${tag} timestamp is ${fmt(ev.at - now)} in the future; check the device clock`);
    at = Math.min(ev.receivedAt, now);
    clock = "server arrival";
    if (at < startedAt) return skip("arrived before the start");
  }

  stopTeam(a.id, s.id, team.id, at, "sensor");
  log.info(
    `stopped ${team.name} (lane ${lane}) from ${tag} at ${fmt(at - startedAt)} (${clock}, ` +
      `${now - ev.receivedAt}ms after the server got it) · ${a.name} / ${STAGE_LABEL[s.id]}`
  );
}

export function connectSensors() {
  let retry = 0;
  let ping = 0;

  const open = () => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/api/events`);
    setStatus("connecting");

    ws.onopen = () => {
      if (retry) log.info(`reconnected after ${retry} attempt(s)`);
      retry = 0;
      setStatus("online");
      ping = window.setInterval(() => ws.send("ping"), 25_000);
    };
    ws.onmessage = (m) => {
      if (m.data === "pong") return;
      let events: FinishEvent[];
      try {
        events = JSON.parse(m.data);
      } catch {
        return log.warn("malformed frame", m.data);
      }
      log.info(`received ${events.length} event(s)`);
      events.forEach(apply);
    };
    ws.onclose = (e) => {
      clearInterval(ping);
      setStatus("offline");
      const delay = Math.min(10_000, 500 * 2 ** retry++);
      log.warn(`socket closed (code ${e.code}); retrying in ${delay}ms`);
      setTimeout(open, delay);
    };
  };

  open();
}
