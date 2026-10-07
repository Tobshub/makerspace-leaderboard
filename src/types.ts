export type StageId = "r1" | "r2" | "final";

export const STAGE_ORDER: StageId[] = ["r1", "r2", "final"];

export const STAGE_LABEL: Record<StageId, string> = {
  r1: "Round 1",
  r2: "Round 2",
  final: "Main Race",
};

export interface Team {
  id: string;
  name: string;
}

export interface Entry {
  teamId: string;
  /** Raw elapsed time (ms) from race start when this team was stopped. */
  finishMs: number | null;
  dnf: boolean;
  penaltyMs: number;
  /** Stopped automatically by a finish-line sensor rather than by hand. */
  bySensor?: boolean;
}

export type StageStatus = "setup" | "running" | "done";

export interface Stage {
  id: StageId;
  status: StageStatus;
  teams: Team[];
  entries: Entry[];
  startedAt: number | null;
  endedAt: number | null;
}

export interface Settings {
  /** How many per round "Pick top N" selects for the main race; finalists are chosen by hand. */
  advance: number;
  /** Points awarded by placement; index 0 = 1st place. */
  points: number[];
  /** Penalty added per click, in seconds. */
  penaltySec: number;
  /** 3-2-1 countdown before the clock starts; 0 disables it. */
  countdownSec: number;
  /**
   * Which lane each finish-line sensor stops: index 0 = sensor 1, value = 1-based lane,
   * null = sensor ignored. Missing (older activities) means sensor N → lane N.
   */
  sensorLanes?: (number | null)[];
}

export interface Activity {
  id: string;
  name: string;
  createdAt: number;
  settings: Settings;
  stages: Record<StageId, Stage>;
  /** Stage currently shown on the audience display. */
  live: StageId;
}

export interface Standing {
  team: Team;
  entry: Entry;
  /** Total time including penalties; null for DNF / unfinished. */
  totalMs: number | null;
  rank: number | null;
  points: number;
  qualified: boolean;
}
