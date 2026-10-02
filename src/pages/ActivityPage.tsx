import { useState } from "react";
import Shell from "../components/Shell";
import { TrashIcon } from "../components/Icons";
import { go } from "../hooks";
import { eventPoints, fmt, qualifiers, standings, toCSV } from "../logic";
import { deleteActivity, renameActivity, updateSettings } from "../store";
import { STAGE_LABEL, STAGE_ORDER, type Activity, type StageId } from "../types";

export default function ActivityPage({ activity: a }: { activity: Activity }) {
  const totals = eventPoints(a);

  const exportCsv = () => {
    const blob = new Blob([toCSV(a)], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${a.name.replace(/[^\w-]+/g, "_")}_results.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const remove = () => {
    if (!confirm(`Delete “${a.name}” and all its results? This can't be undone.`)) return;
    deleteActivity(a.id);
    go("/");
  };

  return (
    <Shell crumbs={[{ label: a.name }]} displayFor={a.id}>
      <header className="page-head grid-bg">
        <div className="wrap">
          <span className="kicker kicker--accent">
            <span className="dot" />
            Activity
          </span>
          <h1 className="display">
            <textarea
              className="title-input"
              rows={1}
              value={a.name}
              onChange={(e) => renameActivity(a.id, e.target.value.replace(/\n/g, " "))}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              aria-label="Activity name"
            />
          </h1>
        </div>
      </header>

      <section className="section">
        <div className="wrap">
          <div className="sechead">
            <div>
              <span className="kicker">
                <span className="dot" />
                Stages
              </span>
              <h2 className="h3">
                Top {a.settings.advance} from each round go through to the main race.
              </h2>
            </div>
          </div>
          <div className="steps">
            {STAGE_ORDER.map((id, i) => (
              <StageCard key={id} a={a} id={id} n={i + 1} />
            ))}
          </div>
        </div>
      </section>

      {totals.length > 0 && (
        <section className="section">
          <div className="wrap">
            <div className="sechead">
              <div>
                <span className="kicker">
                  <span className="dot" />
                  Event points
                </span>
                <h2 className="h3">Points across every completed stage</h2>
              </div>
              <button className="btn btn--sm" onClick={exportCsv}>
                Export CSV <span className="arr">↓</span>
              </button>
            </div>
            <div className="panel table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Team</th>
                    {STAGE_ORDER.map((s) => (
                      <th key={s} className="num">
                        {STAGE_LABEL[s]}
                      </th>
                    ))}
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {totals.map((t) => (
                    <tr key={t.name}>
                      <td>{t.name}</td>
                      {STAGE_ORDER.map((s) => (
                        <td key={s} className="num muted">
                          {t.stages[s] ?? "—"}
                        </td>
                      ))}
                      <td className="num accent-text" style={{ fontWeight: 700 }}>
                        {t.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="wrap">
          <SettingsPanel a={a} />
          <div className="row" style={{ marginTop: 24, justifyContent: "flex-end" }}>
            <button className="btn btn--sm btn--danger" onClick={remove}>
              <TrashIcon size={14} /> Delete activity
            </button>
          </div>
        </div>
      </section>
    </Shell>
  );
}

function StageCard({ a, id, n }: { a: Activity; id: StageId; n: number }) {
  const s = a.stages[id];
  const quals = qualifiers(a);
  const locked = id === "final" && s.status === "setup" && quals.length === 0;
  const href = `#/a/${a.id}/${id}`;

  let badge = (
    <span className="badge">
      <span className="dot" />
      Setup
    </span>
  );
  if (locked)
    badge = (
      <span className="badge">
        <span className="dot" />
        Locked
      </span>
    );
  if (s.status === "running")
    badge = (
      <span className="badge badge--live">
        <span className="dot" />
        Live
      </span>
    );
  if (s.status === "done")
    badge = (
      <span className="badge badge--done">
        <span className="dot" />
        Done
      </span>
    );

  let body: React.ReactNode;
  let cta = "Add teams";
  if (s.status === "done") {
    const rows = standings(s, a.settings);
    cta = "View results";
    body = rows.map((r) => (
      <li key={r.team.id} className={r.qualified || (id === "final" && r.rank === 1) ? "q" : ""}>
        <span>
          {r.rank ?? "—"}. {r.team.name}
        </span>
        <span>{r.entry.dnf ? "DNF" : fmt(r.totalMs)}</span>
      </li>
    ));
  } else if (s.status === "running") {
    cta = "Back to race";
    body = s.teams.map((t) => (
      <li key={t.id}>
        <span>{t.name}</span>
      </li>
    ));
  } else if (id === "final") {
    cta = "Set up main race";
    body = locked ? (
      <li>
        <span>Unlocks when Round 1 &amp; 2 are complete.</span>
      </li>
    ) : (
      quals.map((t) => (
        <li key={t.id} className="q">
          <span>{t.name}</span>
        </li>
      ))
    );
  } else {
    body = s.teams.length ? (
      s.teams.map((t) => (
        <li key={t.id}>
          <span>{t.name}</span>
        </li>
      ))
    ) : (
      <li>
        <span>No teams yet.</span>
      </li>
    );
  }

  return (
    <div className={"step" + (locked ? " step--locked" : "")}>
      <div className="step__top">
        <span className="step__n">{String(n).padStart(2, "0")}</span>
        {badge}
      </div>
      <h3 className="step__title">{STAGE_LABEL[id]}</h3>
      <ul className="step__list">{body}</ul>
      {locked ? (
        <button className="btn btn--sm" disabled>
          Locked
        </button>
      ) : (
        <a
          className={"btn btn--sm" + (s.status === "running" ? " btn--accent" : "")}
          href={href}
        >
          {cta} <span className="arr">→</span>
        </a>
      )}
    </div>
  );
}

function SettingsPanel({ a }: { a: Activity }) {
  const [points, setPoints] = useState(a.settings.points.join(", "));
  const commitPoints = () => {
    const list = points
      .split(/[\s,]+/)
      .map(Number)
      .filter((x) => Number.isFinite(x) && x >= 0);
    updateSettings(a.id, { points: list });
    setPoints(list.join(", "));
  };
  const finalStarted = a.stages.final.status !== "setup";

  return (
    <div className="console">
      <div className="console__bar">
        <div className="dots">
          <i />
          <i />
          <i />
        </div>
        <span className="path">~/settings</span>
      </div>
      <div className="console__body">
        <div className="settings-grid">
          <div className="field">
            <label htmlFor="adv">Teams advancing per round</label>
            <input
              id="adv"
              type="number"
              min={1}
              max={10}
              value={a.settings.advance}
              disabled={finalStarted}
              onChange={(e) =>
                updateSettings(a.id, { advance: Math.max(1, Number(e.target.value) || 1) })
              }
            />
            {finalStarted && <div className="hint">Locked once the main race has started.</div>}
          </div>
          <div className="field">
            <label htmlFor="pen">Penalty step (seconds)</label>
            <input
              id="pen"
              type="number"
              min={1}
              value={a.settings.penaltySec}
              onChange={(e) =>
                updateSettings(a.id, { penaltySec: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="cd">Start countdown (seconds)</label>
            <input
              id="cd"
              type="number"
              min={0}
              max={10}
              value={a.settings.countdownSec}
              onChange={(e) =>
                updateSettings(a.id, {
                  countdownSec: Math.min(10, Math.max(0, Number(e.target.value) || 0)),
                })
              }
            />
          </div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="pts">Points by placement (1st, 2nd, 3rd…)</label>
          <input
            id="pts"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            onBlur={commitPoints}
            onKeyDown={(e) => e.key === "Enter" && commitPoints()}
          />
          <div className="hint">Placements past the end of this list score 0. DNF scores 0.</div>
        </div>
      </div>
    </div>
  );
}
