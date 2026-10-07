import { fmt, ordinal } from "../logic";
import type { Entry, Team } from "../types";

export interface LaneControls {
  onStop: () => void;
  onDnf: () => void;
  onUndo: () => void;
  onPenalty: (deltaMs: number) => void;
  penaltySec: number;
}

export default function Lane({
  index,
  team,
  entry,
  elapsed,
  position,
  controls,
}: {
  index: number;
  team: Team;
  entry: Entry;
  /** Elapsed ms on the main clock (negative while counting down). */
  elapsed: number;
  /** Provisional finishing position, if stopped. */
  position: number | null;
  controls?: LaneControls;
}) {
  const stopped = entry.finishMs != null;
  const time = entry.dnf ? null : stopped ? entry.finishMs : Math.max(0, elapsed);
  const counting = elapsed < 0;
  const key = index < 9 ? String(index + 1) : index === 9 ? "0" : null;

  return (
    <div
      className={
        "lane panel" + (stopped ? " lane--done ticked" : "") + (entry.dnf ? " lane--dnf" : "")
      }
    >
      <div className="lane__top">
        <span className="lane__pos">
          {stopped && position ? ordinal(position) : entry.dnf ? "DNF" : `Lane ${index + 1}`}
        </span>
        {stopped && entry.bySensor ? (
          <span className="lane__key" title="Stopped by the finish-line sensor">
            Sensor
          </span>
        ) : (
          controls && key && <span className="lane__key">{key}</span>
        )}
      </div>
      <h3 className="lane__name" title={team.name}>
        {team.name}
      </h3>
      <div className="clock">{entry.dnf ? "DNF" : fmt(time)}</div>
      <div className="lane__pen">
        {entry.penaltyMs > 0 && `+${entry.penaltyMs / 1000}s penalty`}
      </div>

      {controls &&
        (stopped || entry.dnf ? (
          <div className="lane__tools">
            <button className="btn btn--sm" onClick={controls.onUndo}>
              Undo stop
            </button>
            <PenaltyButtons controls={controls} entry={entry} />
          </div>
        ) : (
          <>
            <button
              className="btn btn--accent lane__stop"
              onClick={controls.onStop}
              disabled={counting}
            >
              Stop
            </button>
            <div className="lane__tools">
              <button className="btn btn--sm btn--danger" onClick={controls.onDnf} disabled={counting}>
                DNF
              </button>
              <PenaltyButtons controls={controls} entry={entry} />
            </div>
          </>
        ))}
    </div>
  );
}

function PenaltyButtons({ controls, entry }: { controls: LaneControls; entry: Entry }) {
  const step = controls.penaltySec * 1000;
  return (
    <>
      <button className="btn btn--sm" onClick={() => controls.onPenalty(step)} title="Add penalty">
        +{controls.penaltySec}s
      </button>
      <button
        className="btn btn--sm"
        onClick={() => controls.onPenalty(-step)}
        disabled={entry.penaltyMs <= 0}
        title="Remove penalty"
      >
        −{controls.penaltySec}s
      </button>
    </>
  );
}
