import { useEffect, useState } from "react";
import Lane from "../components/Lane";
import { Confetti, Leaderboard, Podium } from "../components/Leaderboard";
import Shell from "../components/Shell";
import { DownIcon, TrashIcon, UpIcon } from "../components/Icons";
import { go, useKeys, useNow } from "../hooks";
import { useSensorStatus } from "../sensors";
import { fmt, ordinal, qualifiers, sensorsForLane, standings } from "../logic";
import * as store from "../store";
import { STAGE_LABEL, type Activity, type StageId } from "../types";

export default function StagePage({
  activity: a,
  stageId,
}: {
  activity: Activity;
  stageId: StageId;
}) {
  const stage = a.stages[stageId];

  // Whatever the operator is looking at is what the audience display shows.
  useEffect(() => {
    if (a.live !== stageId) store.setLive(a.id, stageId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.id, stageId]);

  const locked = stageId === "final" && stage.status === "setup" && qualifiers(a).length === 0;

  return (
    <Shell
      crumbs={[{ label: a.name, href: `#/a/${a.id}` }, { label: STAGE_LABEL[stageId] }]}
      displayFor={a.id}
    >
      {locked ? (
        <div className="wrap section">
          <div className="empty">
            The main race unlocks once Round 1 and Round 2 are complete.
            <div style={{ marginTop: 20 }}>
              <a className="btn btn--sm" href={`#/a/${a.id}`}>
                Back to activity
              </a>
            </div>
          </div>
        </div>
      ) : stage.status === "setup" ? (
        <Setup a={a} stageId={stageId} />
      ) : stage.status === "running" ? (
        <Race a={a} stageId={stageId} />
      ) : (
        <Results a={a} stageId={stageId} />
      )}
    </Shell>
  );
}

/* ============================================================
   SETUP
   ============================================================ */

function Setup({ a, stageId }: { a: Activity; stageId: StageId }) {
  const stage = a.stages[stageId];
  const isFinal = stageId === "final";
  const teams = isFinal ? qualifiers(a) : stage.teams;
  const [name, setName] = useState("");
  const [bulk, setBulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    store.addTeams(a.id, stageId, [name]);
    setName("");
  };
  const addBulk = () => {
    store.addTeams(a.id, stageId, bulk.split(/\n|,/));
    setBulk("");
    setShowBulk(false);
  };
  const start = () => teams.length && store.startRace(a.id, stageId);

  // Teams already entered in the other round(s) of this activity, not yet in this one.
  const taken = new Set(stage.teams.map((t) => t.name.trim().toLowerCase()));
  const otherRounds = (["r1", "r2"] as const).filter((id) => id !== stageId);
  const reusable = otherRounds.flatMap((id) =>
    a.stages[id].teams
      .filter((t) => t.name.trim() && !taken.has(t.name.trim().toLowerCase()))
      .map((t) => ({ ...t, from: id }))
  );

  useKeys(
    (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        start();
      }
    },
    [teams.length, a.id, stageId]
  );

  // Where each finalist qualified from, e.g. "Round 1 · 1st".
  const source = (teamId: string) => {
    for (const id of ["r1", "r2"] as const) {
      const r = standings(a.stages[id], a.settings).find((x) => x.team.id === teamId);
      if (r) return `${STAGE_LABEL[id]} · ${ordinal(r.rank!)}`;
    }
    return "";
  };

  return (
    <>
      <header className="page-head grid-bg">
        <div className="wrap">
          <span className="kicker kicker--accent">
            <span className="dot" />
            {STAGE_LABEL[stageId]} · Setup
          </span>
          <h1 className="display">{isFinal ? "Finalists" : "Add teams"}</h1>
          <p className="lead">
            {isFinal
              ? `The top ${a.settings.advance} from Round 1 and Round 2 race for the title.`
              : "Add every team racing in this round. Lane numbers double as keyboard shortcuts during the race."}
          </p>
        </div>
      </header>

      <section className="section">
        <div className="wrap setup-grid">
          <div className="console">
            <div className="console__bar">
              <div className="dots">
                <i />
                <i />
                <i />
              </div>
              <span className="path">
                ~/{stageId}/teams · {teams.length}
              </span>
            </div>
            {teams.length === 0 ? (
              <div className="console__body muted mono" style={{ fontSize: 13 }}>
                No teams yet.
              </div>
            ) : (
              <ul className="roster">
                {teams.map((t, i) => (
                  <li key={t.id}>
                    <span className="roster__n">{String(i + 1).padStart(2, "0")}</span>
                    {isFinal ? (
                      <>
                        <span
                          style={{ flex: 1, fontSize: 17, fontWeight: 500, padding: "6px 8px" }}
                        >
                          {t.name}
                        </span>
                        <span className="roster__src">{source(t.id)}</span>
                      </>
                    ) : (
                      <>
                        <input
                          value={t.name}
                          onChange={(e) => store.renameTeam(a.id, stageId, t.id, e.target.value)}
                          aria-label={`Team ${i + 1} name`}
                        />
                        <button
                          className="icon-btn"
                          onClick={() => store.moveTeam(a.id, stageId, t.id, -1)}
                          disabled={i === 0}
                          aria-label="Move up"
                        >
                          <UpIcon />
                        </button>
                        <button
                          className="icon-btn"
                          onClick={() => store.moveTeam(a.id, stageId, t.id, 1)}
                          disabled={i === teams.length - 1}
                          aria-label="Move down"
                        >
                          <DownIcon />
                        </button>
                        <button
                          className="icon-btn icon-btn--danger"
                          onClick={() => store.removeTeam(a.id, stageId, t.id)}
                          aria-label="Remove team"
                        >
                          <TrashIcon />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!isFinal && (
            <div className="side-stack">
              <div className="console">
                <div className="console__bar">
                  <div className="dots">
                    <i />
                    <i />
                    <i />
                  </div>
                  <span className="path">~/add-team</span>
                </div>
                <div className="console__body">
                  <form onSubmit={add}>
                    <div className="field">
                      <label htmlFor="tname">Team name</label>
                      <input
                        id="tname"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Team Voltron"
                        autoComplete="off"
                        autoFocus
                        list="known-teams"
                      />
                      <datalist id="known-teams">
                        {reusable.map((t) => (
                          <option key={t.id} value={t.name} />
                        ))}
                      </datalist>
                    </div>
                    <button className="btn btn--accent" type="submit" style={{ width: "100%" }}>
                      Add team <span className="arr">→</span>
                    </button>
                  </form>
                  <div style={{ marginTop: 16 }}>
                    {showBulk ? (
                      <>
                        <div className="field">
                          <label htmlFor="bulk">Paste teams (one per line)</label>
                          <textarea
                            id="bulk"
                            value={bulk}
                            onChange={(e) => setBulk(e.target.value)}
                          />
                        </div>
                        <div className="row">
                          <button className="btn btn--sm" onClick={addBulk}>
                            Add all
                          </button>
                          <button
                            className="btn btn--sm btn--ghost"
                            onClick={() => setShowBulk(false)}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <button className="btn btn--sm btn--ghost" onClick={() => setShowBulk(true)}>
                        + Paste a list
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {reusable.length > 0 && (
                <div className="console">
                  <div className="console__bar">
                    <div className="dots">
                      <i />
                      <i />
                      <i />
                    </div>
                    <span className="path">
                      ~/from-
                      {otherRounds
                        .map((id) => STAGE_LABEL[id].toLowerCase().replace(" ", "-"))
                        .join("+")}
                    </span>
                  </div>
                  <div className="console__body">
                    <label className="field-label">
                      From {otherRounds.map((id) => STAGE_LABEL[id]).join(" & ")} · click to add
                    </label>
                    <div className="chips">
                      {reusable.map((t) => (
                        <button
                          key={t.id}
                          className="chip"
                          onClick={() => store.addTeams(a.id, stageId, [t.name])}
                        >
                          <span aria-hidden>+</span> {t.name}
                        </button>
                      ))}
                    </div>
                    <button
                      className="btn btn--sm"
                      style={{ marginTop: 16 }}
                      onClick={() =>
                        store.addTeams(
                          a.id,
                          stageId,
                          reusable.map((t) => t.name)
                        )
                      }
                    >
                      Add all {reusable.length}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="wrap">
          <div className="launch panel ticked">
            <div>
              <span className="kicker">
                <span className="dot" />
                {teams.length} {teams.length === 1 ? "team" : "teams"} ready
              </span>
              <p className="muted" style={{ margin: "8px 0 0", fontSize: 14 }}>
                {a.settings.countdownSec > 0
                  ? `${a.settings.countdownSec}s countdown, then the clock starts for every team.`
                  : "The clock starts immediately for every team."}{" "}
                Press <kbd>Space</kbd> to start.
              </p>
            </div>
            <button className="btn btn--accent btn--lg" onClick={start} disabled={!teams.length}>
              Start main timer <span className="arr">→</span>
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

/* ============================================================
   RACE
   ============================================================ */

function Race({ a, stageId }: { a: Activity; stageId: StageId }) {
  const stage = a.stages[stageId];
  const now = useNow(true);
  const elapsed = now - (stage.startedAt ?? now);
  const counting = elapsed < 0;
  const ranks = new Map(standings(stage, a.settings).map((r) => [r.team.id, r.rank]));
  const entry = (teamId: string) => stage.entries.find((e) => e.teamId === teamId)!;
  const remaining = stage.entries.filter((e) => e.finishMs == null && !e.dnf).length;

  useKeys(
    (e) => {
      const n = e.key === "0" ? 10 : Number(e.key);
      if (!Number.isInteger(n) || n < 1) return;
      const t = stage.teams[n - 1];
      if (t) store.stopTeam(a.id, stageId, t.id, Date.now());
    },
    [stage.teams, a.id, stageId]
  );

  const endRace = () => {
    if (
      remaining &&
      !confirm(`End the race now? ${remaining} team(s) still running will be marked DNF.`)
    )
      return;
    store.endRace(a.id, stageId);
  };
  const abort = () => {
    if (!confirm("Abort this race and clear all times? Teams are kept.")) return;
    store.resetStage(a.id, stageId);
  };

  return (
    <div className="wrap">
      <div className="race-head">
        <div>
          <span className="badge badge--live" style={{ marginBottom: 14 }}>
            <span className="dot" />
            {STAGE_LABEL[stageId]} · {counting ? "Get ready" : "Live"}
          </span>
          <div className={"clock" + (counting ? " count" : "")}>
            {counting ? Math.ceil(-elapsed / 1000) : fmt(elapsed)}
          </div>
        </div>
        <div className="mono muted" style={{ fontSize: 13, textAlign: "right" }}>
          <SensorBadge />
          <br />
          {stage.teams.length - remaining}/{stage.teams.length} finished
          <br />
          Keys <kbd>1</kbd>–<kbd>{Math.min(stage.teams.length, 9)}</kbd>
          {stage.teams.length >= 10 && (
            <>
              {" "}
              <kbd>0</kbd>
            </>
          )}{" "}
          stop a lane
        </div>
      </div>

      <div className="lanes">
        {stage.teams.map((t, i) => (
          <Lane
            key={t.id}
            index={i}
            team={t}
            entry={entry(t.id)}
            elapsed={elapsed}
            position={ranks.get(t.id) ?? null}
            sensors={sensorsForLane(a.settings, i + 1)}
            controls={{
              penaltySec: a.settings.penaltySec,
              onStop: () => store.stopTeam(a.id, stageId, t.id, Date.now()),
              onDnf: () => store.markDnf(a.id, stageId, t.id),
              onUndo: () => store.undoStop(a.id, stageId, t.id),
              onPenalty: (d) => store.addPenalty(a.id, stageId, t.id, d),
            }}
          />
        ))}
      </div>

      <div className="race-foot">
        <button className="btn btn--sm btn--danger" onClick={abort}>
          Abort &amp; reset
        </button>
        <button className="btn btn--sm" onClick={endRace}>
          {remaining ? "End race now" : "Show leaderboard"} <span className="arr">→</span>
        </button>
      </div>
    </div>
  );
}

function SensorBadge() {
  const status = useSensorStatus();
  const label = { online: "Sensors live", connecting: "Sensors connecting", offline: "Sensors offline" };
  return (
    <span
      className={"badge" + (status === "online" ? " badge--done" : "")}
      style={{ marginBottom: 10 }}
      title="Finish-line sensors stop lanes automatically while connected"
    >
      <span className="dot" />
      {label[status]}
    </span>
  );
}

/* ============================================================
   RESULTS
   ============================================================ */

function Results({ a, stageId }: { a: Activity; stageId: StageId }) {
  const stage = a.stages[stageId];
  const rows = standings(stage, a.settings);
  const isFinal = stageId === "final";
  const winner = isFinal ? rows.find((r) => r.rank === 1) : undefined;
  const finalStarted = a.stages.final.status !== "setup";
  const canReopen = isFinal || !finalStarted;

  const next: { label: string; to: string } | null =
    stageId === "r1" && a.stages.r2.status !== "done"
      ? { label: "Go to Round 2", to: `/a/${a.id}/r2` }
      : !isFinal && qualifiers(a).length && a.stages.final.status !== "done"
        ? { label: "Go to Main Race", to: `/a/${a.id}/final` }
        : null;

  const reset = () => {
    if (!confirm(`Clear all ${STAGE_LABEL[stageId]} times and go back to setup?`)) return;
    store.resetStage(a.id, stageId);
  };

  return (
    <>
      {winner && <Confetti />}
      {winner ? (
        <header className="winner-banner grid-bg">
          <div className="wrap">
            <span className="kicker kicker--accent">
              <span className="dot" />
              {a.name} · Final standings
            </span>
            <h1 className="display">
              <span>{winner.team.name}</span>
              <br />
              wins.
            </h1>
          </div>
        </header>
      ) : (
        <header className="page-head grid-bg">
          <div className="wrap page-head__row">
            <div>
              <span className="kicker kicker--accent">
                <span className="dot" />
                {STAGE_LABEL[stageId]} · Results
              </span>
              <h1 className="display">Leaderboard</h1>
              {!isFinal && (
                <p className="lead">Top {a.settings.advance} qualify for the main race.</p>
              )}
            </div>
            {next && (
              <button className="btn btn--accent btn--lg" onClick={() => go(next.to)}>
                {next.label} <span className="arr">→</span>
              </button>
            )}
          </div>
        </header>
      )}

      <section className="section">
        <div className="wrap">
          {isFinal && <Podium rows={rows} />}
          <Leaderboard rows={rows} showQualified={!isFinal} />

          <div className="race-foot" style={{ marginTop: 32 }}>
            <div className="row">
              <button
                className="btn btn--sm"
                onClick={() => store.reopenRace(a.id, stageId)}
                disabled={!canReopen}
                title={canReopen ? "Fix a stop, DNF or penalty" : "Reset the main race first"}
              >
                Reopen race
              </button>
              <button className="btn btn--sm btn--danger" onClick={reset} disabled={!canReopen}>
                Reset stage
              </button>
            </div>
            <a className="btn btn--sm" href={`#/a/${a.id}`}>
              Activity overview <span className="arr">→</span>
            </a>
          </div>
          {!canReopen && (
            <p className="hint">
              The main race has started from these results — reset it before changing this round.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
