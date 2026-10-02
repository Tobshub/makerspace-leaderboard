import Lane from "../components/Lane";
import { ExpandIcon } from "../components/Icons";
import { Confetti, Leaderboard, Podium } from "../components/Leaderboard";
import { useNow } from "../hooks";
import { fmt, qualifiers, standings } from "../logic";
import { STAGE_LABEL, type Activity } from "../types";

/**
 * Audience-facing screen for a projector. It follows whichever stage the operator has open
 * (activity.live) and updates live through localStorage `storage` events.
 */
export default function Display({ activity: a }: { activity: Activity }) {
  const stage = a.stages[a.live];
  const now = useNow(stage.status === "running");
  const rows = standings(stage, a.settings);
  const isFinal = stage.id === "final";

  let body: React.ReactNode;

  if (stage.status === "setup") {
    const teams = isFinal ? qualifiers(a) : stage.teams;
    body = (
      <div className="screen__center">
        <div>
          <span className="kicker kicker--accent">
            <span className="dot" />
            Up next
          </span>
          <h2 className="display" style={{ marginTop: 16 }}>
            {STAGE_LABEL[stage.id]}
          </h2>
          <div className="lineup">
            {teams.map((t) => (
              <div key={t.id} className="panel ticked">
                {t.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  } else if (stage.status === "running") {
    const elapsed = now - (stage.startedAt ?? now);
    const counting = elapsed < 0;
    const ranks = new Map(rows.map((r) => [r.team.id, r.rank]));
    body = (
      <>
        <div className={"clock screen__clock" + (counting ? " count" : "")}>
          {counting ? Math.ceil(-elapsed / 1000) : fmt(elapsed)}
        </div>
        <div className="screen__lanes">
          {stage.teams.map((t, i) => (
            <Lane
              key={t.id}
              index={i}
              team={t}
              entry={stage.entries.find((e) => e.teamId === t.id)!}
              elapsed={elapsed}
              position={ranks.get(t.id) ?? null}
            />
          ))}
        </div>
      </>
    );
  } else {
    const winner = isFinal ? rows.find((r) => r.rank === 1) : undefined;
    body = (
      <>
        {winner && <Confetti count={140} />}
        {winner && (
          <div className="winner-banner" style={{ padding: "1vh 0 2vh" }}>
            <span className="kicker kicker--accent">
              <span className="dot" />
              Champion
            </span>
            <h2 className="display">
              <span>{winner.team.name}</span>
            </h2>
          </div>
        )}
        {isFinal && <Podium rows={rows} />}
        <Leaderboard rows={rows} showQualified={!isFinal} />
      </>
    );
  }

  return (
    <div className="screen grid-bg">
      <div className="screen__top">
        <div>
          <span className="kicker">
            <span className="dot" />
            {a.name}
          </span>
          <h1 className="screen__title">
            {STAGE_LABEL[stage.id]}
            {stage.status === "done" && <span className="accent-text"> · Results</span>}
          </h1>
        </div>
        <div className="row">
          <button
            className="icon-btn"
            aria-label="Fullscreen"
            onClick={() =>
              document.fullscreenElement
                ? document.exitFullscreen()
                : document.documentElement.requestFullscreen()
            }
          >
            <ExpandIcon />
          </button>
          <img src="/logo.png" alt="SST Makerspace" />
        </div>
      </div>
      {body}
    </div>
  );
}
