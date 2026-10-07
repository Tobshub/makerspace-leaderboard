import { SENSOR_COUNT } from "../shared/sensor";
import { STAGE_LABEL } from "./types";
import type { Activity, Settings, Stage, StageId, Standing, Team } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  advance: 2,
  points: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
  penaltySec: 5,
  countdownSec: 3,
  sensorLanes: Array.from({ length: SENSOR_COUNT }, (_, i) => i + 1),
};

/** Lane (1-based) that a sensor stops in this activity, or null if it's switched off. */
export function laneForSensor(settings: Settings, sensor: number): number | null {
  const lanes = settings.sensorLanes;
  return lanes && sensor - 1 < lanes.length ? lanes[sensor - 1] : sensor;
}

/** Sensors (1-based) mapped to a lane, for showing on lane cards. */
export function sensorsForLane(settings: Settings, lane: number): number[] {
  const out: number[] = [];
  for (let s = 1; s <= SENSOR_COUNT; s++) if (laneForSensor(settings, s) === lane) out.push(s);
  return out;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyStage(id: StageId): Stage {
  return { id, status: "setup", teams: [], entries: [], startedAt: null, endedAt: null };
}

export function newActivity(name: string, settings: Partial<Settings> = {}): Activity {
  return {
    id: uid(),
    name,
    createdAt: Date.now(),
    settings: structuredClone({ ...DEFAULT_SETTINGS, ...settings }),
    stages: { r1: emptyStage("r1"), r2: emptyStage("r2"), final: emptyStage("final") },
    live: "r1",
  };
}

/** mm:ss.cc — or h:mm:ss.cc past an hour. */
export function fmt(ms: number | null | undefined) {
  if (ms == null) return "--:--.--";
  const cs = Math.floor(ms / 10) % 100;
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000);
  const p = (n: number) => String(n).padStart(2, "0");
  return (h ? `${h}:${p(m)}` : p(m)) + `:${p(s)}.${p(cs)}`;
}

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Rank a stage. Finished teams sort by time (+penalties); equal times share a rank and
 * the points for that rank. DNF / unfinished teams are unranked and score nothing.
 */
/**
 * Rank a stage. `finalists` (ids picked for the main race) marks round rows as qualified;
 * see `finalistIds`.
 */
export function standings(
  stage: Stage,
  settings: Settings,
  finalists: ReadonlySet<string> = new Set()
): Standing[] {
  const rows = stage.teams.map((team) => {
    const entry = stage.entries.find((e) => e.teamId === team.id) ?? {
      teamId: team.id,
      finishMs: null,
      dnf: false,
      penaltyMs: 0,
    };
    const totalMs = !entry.dnf && entry.finishMs != null ? entry.finishMs + entry.penaltyMs : null;
    return { team, entry, totalMs };
  });

  const finished = rows
    .filter((r) => r.totalMs != null)
    .sort((a, b) => a.totalMs! - b.totalMs!);
  const unfinished = rows.filter((r) => r.totalMs == null);

  const out: Standing[] = [];
  finished.forEach((r, i) => {
    const prev = out[i - 1];
    const rank = prev && prev.totalMs === r.totalMs ? prev.rank! : i + 1;
    out.push({
      ...r,
      rank,
      points: settings.points[rank - 1] ?? 0,
      qualified: stage.id !== "final" && finalists.has(r.team.id),
    });
  });
  for (const r of unfinished)
    out.push({ ...r, rank: null, points: 0, qualified: stage.id !== "final" && finalists.has(r.team.id) });
  return out;
}

/** The main race is picked by hand once both rounds have results. */
export function roundsDone(activity: Activity) {
  const { r1, r2 } = activity.stages;
  return r1.status === "done" && r2.status === "done";
}

/** Ids of round teams picked for the main race (finalists keep their round team id). */
export function finalistIds(activity: Activity): Set<string> {
  return new Set(activity.stages.final.teams.map((t) => t.id));
}

/** Where a finalist came from, e.g. "Round 1 · 1st". */
export function finalistSource(activity: Activity, teamId: string) {
  for (const id of ["r1", "r2"] as const) {
    const r = standings(activity.stages[id], activity.settings).find((x) => x.team.id === teamId);
    if (r) return `${STAGE_LABEL[id]} · ${r.rank ? ordinal(r.rank) : "DNF"}`;
  }
  return "";
}

/** The top `settings.advance` finishers of each round, as a starting point for picking. */
export function suggestedFinalists(activity: Activity): Team[] {
  const seen = new Set<string>();
  return (["r1", "r2"] as const)
    .flatMap((id) =>
      standings(activity.stages[id], activity.settings)
        .filter((r) => r.rank != null && r.rank <= activity.settings.advance)
        .map((r) => r.team)
    )
    .filter((t) => {
      const key = t.name.trim().toLowerCase();
      return !seen.has(key) && seen.add(key);
    });
}

export function stageLocked(activity: Activity, id: StageId) {
  return id === "final" && activity.stages.final.status === "setup" && !roundsDone(activity);
}

/** Total event points per team across every completed stage. */
export function eventPoints(activity: Activity) {
  const totals = new Map<string, { name: string; points: number; stages: Partial<Record<StageId, number>> }>();
  for (const stage of Object.values(activity.stages)) {
    if (stage.status !== "done") continue;
    for (const s of standings(stage, activity.settings, finalistIds(activity))) {
      const key = s.team.name.trim().toLowerCase();
      const t = totals.get(key) ?? { name: s.team.name, points: 0, stages: {} };
      t.points += s.points;
      t.stages[stage.id] = s.points;
      totals.set(key, t);
    }
  }
  return [...totals.values()].sort((a, b) => b.points - a.points);
}

export function allStopped(stage: Stage) {
  return (
    stage.teams.length > 0 &&
    stage.teams.every((t) => {
      const e = stage.entries.find((x) => x.teamId === t.id);
      return e && (e.dnf || e.finishMs != null);
    })
  );
}

export function toCSV(activity: Activity) {
  const lines = [["Stage", "Rank", "Team", "Time", "Penalty", "Total", "Points", "Finalist"]];
  for (const stage of Object.values(activity.stages)) {
    if (stage.status !== "done") continue;
    for (const s of standings(stage, activity.settings, finalistIds(activity))) {
      lines.push([
        STAGE_LABEL[stage.id],
        s.rank ? String(s.rank) : "DNF",
        s.team.name,
        fmt(s.entry.finishMs),
        (s.entry.penaltyMs / 1000).toString(),
        fmt(s.totalMs),
        String(s.points),
        s.qualified ? "yes" : "",
      ]);
    }
  }
  return lines.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
}
