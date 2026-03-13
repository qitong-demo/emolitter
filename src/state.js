import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {
  configFile,
  eventsFile,
  historyFile,
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
  return readJsonLinesSync(eventsFile);
}

export async function appendJsonLine(filePath, value) {
  await ensureStateDir();
  await fsp.appendFile(filePath, `${JSON.stringify(value)}${os.EOL}`, "utf8");
}

export function readJsonLinesSync(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  return fs
    .readFileSync(filePath, "utf8")
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

export async function replaceSession(value) {
  if (!value) {
    if (fs.existsSync(sessionFile)) {
      await fsp.rm(sessionFile, {force: true});
    }
    return;
  }

  await writeJson(sessionFile, value);
}

export async function updateSession(mutator) {
  const current = readJsonSync(sessionFile);
  if (!current) {
    return null;
  }

  const next = await mutator({...current});
  if (!next) {
    return current;
  }

  await writeJson(sessionFile, next);
  return next;
}

export async function clearPersistentFiles(options = {}) {
  const shouldClearConfig = Boolean(options.config);
  const shouldClearHistory = Boolean(options.history);

  for (const filePath of [
    resultFile,
    ...(shouldClearConfig ? [configFile] : []),
    ...(shouldClearHistory ? [historyFile] : [])
  ]) {
    if (fs.existsSync(filePath)) {
      await fsp.rm(filePath, {force: true});
    }
  }
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
  configFile,
  eventsFile,
  historyFile,
  pidFile,
  resultFile,
  sessionFile,
  stateDir,
  stopFile
};
