import { useState } from "react";
import SensorLanes from "../components/SensorLanes";
import Shell from "../components/Shell";
import { go } from "../hooks";
import { DEFAULT_SETTINGS } from "../logic";
import { createActivity, useActivities } from "../store";
import { STAGE_LABEL, STAGE_ORDER, type Activity } from "../types";

function progress(a: Activity) {
  const running = STAGE_ORDER.find((s) => a.stages[s].status === "running");
  if (running) return { live: true, text: `${STAGE_LABEL[running]} · live` };
  if (a.stages.final.status === "done") return { live: false, text: "Complete" };
  const next = STAGE_ORDER.find((s) => a.stages[s].status === "setup");
  return { live: false, text: next ? `Next · ${STAGE_LABEL[next]}` : "In progress" };
}

export default function Home() {
  const activities = useActivities();
  const [name, setName] = useState("");
  const [sensorLanes, setSensorLanes] = useState(DEFAULT_SETTINGS.sensorLanes!);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = createActivity(name, { sensorLanes });
    setName("");
    go(`/a/${id}`);
  };

  return (
    <Shell>
      <header className="page-head grid-bg">
        <div className="wrap">
          <span className="kicker kicker--accent">
            <span className="dot" />
            SYS · RACE CONTROL
          </span>
          <h1 className="display">
            Bot race
            <br />
            <span className="accent-text">timing &amp; standings.</span>
          </h1>
          <p className="lead">
            Two qualifying rounds, one main race. Time every team, rank them, award points, and
            send the top finishers through to the final.
          </p>
        </div>
      </header>

      <section className="section">
        <div className="wrap home-grid">
          <form className="console" onSubmit={submit}>
            <div className="console__bar">
              <div className="dots">
                <i />
                <i />
                <i />
              </div>
              <span className="path">~/new-activity</span>
            </div>
            <div className="console__body">
              <div className="field">
                <label htmlFor="aname">Activity name</label>
                <input
                  id="aname"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Line Follower Challenge 2026"
                  autoComplete="off"
                />
              </div>
              <SensorLanes value={sensorLanes} onChange={setSensorLanes} />
              <button className="btn btn--accent" type="submit" style={{ width: "100%" }}>
                Add activity <span className="arr">→</span>
              </button>
            </div>
          </form>

          <div>
            <div className="sechead">
              <div>
                <span className="kicker">
                  <span className="dot" />
                  Activities · {String(activities.length).padStart(2, "0")}
                </span>
              </div>
            </div>
            {activities.length === 0 ? (
              <div className="empty">No activities yet — add one to get started.</div>
            ) : (
              <div className="alist">
                {activities.map((a) => {
                  const p = progress(a);
                  const teams = a.stages.r1.teams.length + a.stages.r2.teams.length;
                  return (
                    <a key={a.id} href={`#/a/${a.id}`} className="acard panel">
                      <div style={{ minWidth: 0 }}>
                        <h3 className="acard__name">{a.name}</h3>
                        <div className="acard__meta">
                          <span className={"badge" + (p.live ? " badge--live" : "")}>
                            <span className="dot" />
                            {p.text}
                          </span>
                          <span className="badge">{teams} teams</span>
                          <span className="badge">
                            {new Date(a.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <span className="btn btn--sm">
                        Open <span className="arr">→</span>
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </Shell>
  );
}
