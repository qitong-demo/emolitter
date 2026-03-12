import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {
  eventsFile,
  pidFile,
  resultFile,
  sessionFile,
  stateDir,
  stopFile
} from "./paths.js";

const execFileAsync = promisify(execFile);

export async function ensureStateDir() {
  await fsp.mkdir(stateDir, {recursive: true});
}

export function readJsonSync(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export async function writeJson(filePath, value) {
  await ensureStateDir();
  await fsp.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

export function readPidSync() {
  if (!fs.existsSync(pidFile)) {
    return null;
  }

  const raw = fs.readFileSync(pidFile, "utf8").trim();
  const pid = Number(raw);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

export async function writePid(pid) {
  await ensureStateDir();
  await fsp.writeFile(pidFile, String(pid), "utf8");
}

export async function cleanupRuntimeFiles() {
  for (const filePath of [pidFile, stopFile, sessionFile, eventsFile]) {
    if (fs.existsSync(filePath)) {
      await fsp.rm(filePath, {force: true});
    }
  }
}

export async function clearResultFile() {
  if (fs.existsSync(resultFile)) {
    await fsp.rm(resultFile, {force: true});
  }
}

export async function appendEvent(message, timestamp = new Date()) {
  await ensureStateDir();
  const event = {
    timestamp: timestamp.toISOString(),
    message
  };
  await fsp.appendFile(eventsFile, `${JSON.stringify(event)}${os.EOL}`, "utf8");
}

export function loadEventsSync() {
  if (!fs.existsSync(eventsFile)) {
    return [];
  }

  return fs
    .readFileSync(eventsFile, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export async function isProcessRunning(pid) {
  if (!pid || pid <= 0) {
    return false;
  }

  if (process.platform === "win32") {
    try {
      const {stdout} = await execFileAsync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], {
        windowsHide: true
      });
      return stdout.includes(`"${pid}"`);
    } catch {
      return false;
    }
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function waitForListenerToStop(pid, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!fs.existsSync(sessionFile) && fs.existsSync(resultFile)) {
      return true;
    }

    if (!fs.existsSync(pidFile) && !(await isProcessRunning(pid))) {
      return true;
    }

    if (!(await isProcessRunning(pid))) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return fs.existsSync(resultFile) || !(await isProcessRunning(pid));
}

export {
  eventsFile,
  pidFile,
  resultFile,
  sessionFile,
  stateDir,
  stopFile
};
