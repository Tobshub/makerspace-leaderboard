import { useMemo } from "react";
import { fmt, ordinal } from "../logic";
import type { Standing } from "../types";
import { TrophyIcon } from "./Icons";

export function Leaderboard({ rows, showQualified }: { rows: Standing[]; showQualified: boolean }) {
  return (
    <div className="board">
      <div className="board__head">
        <span>Pos</span>
        <span>Team</span>
        <span>Time</span>
        <span>Pts</span>
      </div>
      {rows.map((r, i) => (
        <div
          key={r.team.id}
          className={
            "brow" +
            (showQualified && r.qualified ? " brow--q ticked" : "") +
            (r.rank == null ? " brow--dnf" : "")
          }
          style={{ animationDelay: `${i * 70}ms` }}
        >
          <span className="brow__rank">{r.rank ?? "—"}</span>
          <span className="brow__name">
            <span>{r.team.name}</span>
            {showQualified && r.qualified && (
              <span className="badge badge--q">Qualified</span>
            )}
            {r.entry.dnf && <span className="badge">DNF</span>}
          </span>
          <span className="brow__time">
            {r.entry.dnf ? "DNF" : fmt(r.totalMs)}
            {r.entry.penaltyMs > 0 && <small>incl. +{r.entry.penaltyMs / 1000}s penalty</small>}
          </span>
          <span className="brow__pts">
            {r.points}
            <small>pts</small>
          </span>
        </div>
      ))}
    </div>
  );
}

export function Podium({ rows }: { rows: Standing[] }) {
  const top = rows.filter((r) => r.rank != null && r.rank <= 3);
  return (
    <div className="podium">
      {top.slice(0, 3).map((r) => (
        <div key={r.team.id} className={`pod pod--${r.rank} panel ticked`}>
          {r.rank === 1 && <TrophyIcon className="trophy" />}
          <span className="pod__place">{r.rank === 1 ? "Champion" : ordinal(r.rank!) + " place"}</span>
          <h3 className="pod__name">{r.team.name}</h3>
          <span className="pod__time">
            {fmt(r.totalMs)} · {r.points} pts
          </span>
        </div>
      ))}
    </div>
  );
}

export function Confetti({ count = 90 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 2.5,
        dur: 3 + Math.random() * 3,
        color: ["var(--accent)", "var(--accent-2)", "var(--gold)", "var(--text)"][i % 4],
        rot: Math.random() * 360,
      })),
    [count]
  );
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p, i) => (
        <i
          key={i}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}
