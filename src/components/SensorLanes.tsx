import { SENSOR_COUNT } from "../../shared/sensor";
import { DEFAULT_SETTINGS } from "../logic";

/** Lanes offered in the picker — matches the 1–9, 0 keyboard shortcuts. */
const MAX_LANES = 10;

/** Pick which lane each finish-line sensor stops. `value[i]` is sensor i+1's lane, or null. */
export default function SensorLanes({
  value = DEFAULT_SETTINGS.sensorLanes!,
  onChange,
}: {
  value?: (number | null)[];
  onChange: (next: (number | null)[]) => void;
}) {
  const lanes = Array.from({ length: SENSOR_COUNT }, (_, i) =>
    i < value.length ? value[i] : i + 1
  );
  const set = (i: number, lane: number | null) =>
    onChange(lanes.map((l, j) => (j === i ? lane : l)));

  const shared = lanes
    .map((l, i) => ({ l, s: i + 1 }))
    .filter(({ l }, _, all) => l != null && all.filter((x) => x.l === l).length > 1);

  return (
    <div className="field">
      <span className="field-label">Finish sensors → lanes</span>
      <div className="sensor-grid">
        {lanes.map((lane, i) => (
          <label key={i} className="sensor-pick">
            <span>Sensor {i + 1}</span>
            <select
              value={lane ?? ""}
              onChange={(e) => set(i, e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Off</option>
              {Array.from({ length: MAX_LANES }, (_, l) => (
                <option key={l} value={l + 1}>
                  Lane {l + 1}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="hint">
        Lane N is the Nth team in a race's line-up.
        {shared.length > 0 &&
          ` Sensors ${shared.map((x) => x.s).join(" & ")} share a lane; whichever fires first stops it.`}
      </div>
    </div>
  );
}
