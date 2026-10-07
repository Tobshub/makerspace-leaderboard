/**
 * A finish-line trigger, as pushed from the server to every open client.
 * This is the app's own shape — whatever ThingsBoard sends is mapped onto it in
 * `worker/thingsboard.ts`, so nothing else needs to change if that payload changes.
 */
/** Finish-line sensors on the ESP32 gate (`sensor1` … `sensor6`). */
export const SENSOR_COUNT = 6;

export interface FinishEvent {
  /** Stable id so a replayed event is only applied once. */
  id: string;
  /** 1-based sensor number. Each activity decides which lane a sensor stops. */
  sensor: number;
  /** When the sensor fired (epoch ms), if the payload carried a timestamp. */
  at: number | null;
  /** When our server received it (epoch ms). */
  receivedAt: number;
  /** Which device reported it, for display/debugging. */
  device: string;
}
