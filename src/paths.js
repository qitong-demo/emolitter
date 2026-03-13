import os from "node:os";
import path from "node:path";

export const stateDir = path.join(os.homedir(), ".emolitter");
export const pidFile = path.join(stateDir, "listener.pid");
export const stopFile = path.join(stateDir, "stop.signal");
export const sessionFile = path.join(stateDir, "session.json");
export const eventsFile = path.join(stateDir, "events.jsonl");
export const resultFile = path.join(stateDir, "result.json");
export const configFile = path.join(stateDir, "config.json");
export const historyFile = path.join(stateDir, "history.jsonl");

export function desktopDir() {
  return path.join(os.homedir(), "Desktop");
}
