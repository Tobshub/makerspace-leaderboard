import { useSyncExternalStore } from "react";
import { allStopped, newActivity, qualifiers, uid } from "./logic";
import type { Activity, Settings, StageId } from "./types";

/*
 * All state lives in localStorage so a refresh mid-race loses nothing, and so a second
 * window (the audience display) stays in sync through the `storage` event.
 */

const KEY = "sst-race-control-v1";
const listeners = new Set<() => void>();

let cacheRaw: string | null = null;
let cache: Activity[] = [];

function read(): Activity[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cache;
  }
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try {
      cache = raw ? JSON.parse(raw) : [];
    } catch {
      cache = [];
    }
  }
  return cache;
}

function write(next: Activity[]) {
  const raw = JSON.stringify(next);
  cacheRaw = raw;
  cache = next;
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    /* storage full / blocked — keep in-memory state */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useActivities() {
  return useSyncExternalStore(subscribe, read);
}

export function useActivity(id: string | undefined) {
  const all = useActivities();
  return all.find((a) => a.id === id);
}

function update(id: string, fn: (a: Activity) => void) {
  write(
    read().map((a) => {
      if (a.id !== id) return a;
      const copy = structuredClone(a);
      fn(copy);
      return copy;
    })
  );
}

/* ---------------- activities ---------------- */

export function createActivity(name: string) {
  const a = newActivity(name.trim() || "Untitled activity");
  write([a, ...read()]);
  return a.id;
}

export function deleteActivity(id: string) {
  write(read().filter((a) => a.id !== id));
}

export function renameActivity(id: string, name: string) {
  update(id, (a) => void (a.name = name));
}

export function updateSettings(id: string, patch: Partial<Settings>) {
  update(id, (a) => void Object.assign(a.settings, patch));
}

export function setLive(id: string, stage: StageId) {
  update(id, (a) => void (a.live = stage));
}

/* ---------------- teams ---------------- */

export function addTeams(id: string, stage: StageId, names: string[]) {
  update(id, (a) => {
    const s = a.stages[stage];
    for (const n of names.map((x) => x.trim()).filter(Boolean)) {
      s.teams.push({ id: uid(), name: n });
    }
  });
}

export function renameTeam(id: string, stage: StageId, teamId: string, name: string) {
  update(id, (a) => {
    const t = a.stages[stage].teams.find((x) => x.id === teamId);
    if (t) t.name = name;
  });
}

export function removeTeam(id: string, stage: StageId, teamId: string) {
  update(id, (a) => {
    const s = a.stages[stage];
    s.teams = s.teams.filter((t) => t.id !== teamId);
    s.entries = s.entries.filter((e) => e.teamId !== teamId);
  });
}

export function moveTeam(id: string, stage: StageId, teamId: string, dir: -1 | 1) {
  update(id, (a) => {
    const t = a.stages[stage].teams;
    const i = t.findIndex((x) => x.id === teamId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= t.length) return;
    [t[i], t[j]] = [t[j], t[i]];
  });
}

/* ---------------- race ---------------- */

export function startRace(id: string, stage: StageId) {
  update(id, (a) => {
    const s = a.stages[stage];
    // The main race line-up is always the current qualifiers from rounds 1 & 2.
    if (stage === "final") s.teams = qualifiers(a).map((t) => ({ ...t }));
    if (!s.teams.length) return;
    s.status = "running";
    s.startedAt = Date.now() + a.settings.countdownSec * 1000;
    s.endedAt = null;
    s.entries = s.teams.map((t) => ({ teamId: t.id, finishMs: null, dnf: false, penaltyMs: 0 }));
    a.live = stage;
  });
}

function finishIfDone(a: Activity, stage: StageId) {
  const s = a.stages[stage];
  if (s.status === "running" && allStopped(s)) {
    s.status = "done";
    s.endedAt = Date.now();
  }
}

export function stopTeam(id: string, stage: StageId, teamId: string, at = Date.now()) {
  update(id, (a) => {
    const s = a.stages[stage];
    const e = s.entries.find((x) => x.teamId === teamId);
    if (s.status !== "running" || !e || e.finishMs != null || e.dnf || s.startedAt == null) return;
    if (at < s.startedAt) return; // still counting down
    e.finishMs = at - s.startedAt;
    finishIfDone(a, stage);
  });
}

export function markDnf(id: string, stage: StageId, teamId: string) {
  update(id, (a) => {
    const e = a.stages[stage].entries.find((x) => x.teamId === teamId);
    if (!e) return;
    e.dnf = true;
    e.finishMs = null;
    finishIfDone(a, stage);
  });
}

/** Clears a team's stop / DNF so its clock keeps running. */
export function undoStop(id: string, stage: StageId, teamId: string) {
  update(id, (a) => {
    const e = a.stages[stage].entries.find((x) => x.teamId === teamId);
    if (!e) return;
    e.finishMs = null;
    e.dnf = false;
  });
}

export function addPenalty(id: string, stage: StageId, teamId: string, deltaMs: number) {
  update(id, (a) => {
    const e = a.stages[stage].entries.find((x) => x.teamId === teamId);
    if (e) e.penaltyMs = Math.max(0, e.penaltyMs + deltaMs);
  });
}

/** Manually end a race: anyone still running is marked DNF. */
export function endRace(id: string, stage: StageId) {
  update(id, (a) => {
    const s = a.stages[stage];
    for (const e of s.entries) if (e.finishMs == null) e.dnf = true;
    finishIfDone(a, stage);
  });
}

/** Re-open a finished race to correct a mistake. The clock is still measured from the original start. */
export function reopenRace(id: string, stage: StageId) {
  update(id, (a) => {
    const s = a.stages[stage];
    s.status = "running";
    s.endedAt = null;
    a.live = stage;
  });
}

export function resetStage(id: string, stage: StageId) {
  update(id, (a) => {
    const s = a.stages[stage];
    s.status = "setup";
    s.entries = [];
    s.startedAt = null;
    s.endedAt = null;
    if (stage === "final") s.teams = [];
  });
}
