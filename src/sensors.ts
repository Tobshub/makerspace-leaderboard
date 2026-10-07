import { useSyncExternalStore } from "react";
import type { FinishEvent } from "../shared/sensor";
import { getActivities, stopTeam } from "./store";

/*
 * Live feed of finish-line triggers from the server (see worker/). Every operator tab applies
 * each event to the running race; the store ignores a stop for a lane that's already stopped,
 * so several open tabs are harmless. The audience display only listens for connection status.
 */

export type SensorStatus = "connecting" | "online" | "offline";

let status: SensorStatus = "connecting";
const listeners = new Set<() => void>();
const seen = new Set<string>();

function setStatus(s: SensorStatus) {
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
 * Turn an event into a stop. Lane N is the Nth team of whichever race is running (the most
 * recently started one if, unusually, several are). The sensor's own timestamp is used when it's
 * plausible for this race; otherwise the time it reached the server.
 */
function apply(ev: FinishEvent) {
  if (seen.has(ev.id)) return;
  seen.add(ev.id);
  if (location.hash.startsWith("#/display")) return;

  const running = getActivities()
    .flatMap((a) => Object.values(a.stages).map((s) => ({ a, s })))
    .filter(({ s }) => s.status === "running" && s.startedAt != null)
    .sort((x, y) => y.s.startedAt! - x.s.startedAt!)[0];
  if (!running) return;

  const { a, s } = running;
  const team = s.teams[ev.lane - 1];
  if (!team) return;
  const now = Date.now();
  const at = ev.at != null && ev.at >= s.startedAt! && ev.at <= now ? ev.at : Math.min(ev.receivedAt, now);
  stopTeam(a.id, s.id, team.id, at, "sensor");
}

export function connectSensors() {
  let retry = 0;
  let ping = 0;

  const open = () => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/api/events`);
    setStatus("connecting");

    ws.onopen = () => {
      retry = 0;
      setStatus("online");
      ping = window.setInterval(() => ws.send("ping"), 25_000);
    };
    ws.onmessage = (m) => {
      if (m.data === "pong") return;
      try {
        (JSON.parse(m.data) as FinishEvent[]).forEach(apply);
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = () => {
      clearInterval(ping);
      setStatus("offline");
      setTimeout(open, Math.min(10_000, 500 * 2 ** retry++));
    };
  };

  open();
}
