import fs from "node:fs";
import {spawn} from "node:child_process";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
import {activeWindow} from "get-windows";
import {GlobalKeyboardListener} from "node-global-key-listener";
import {finalizeLetter, normalizeSession} from "./letter.js";
import {describeKeyEvent, describeWindow} from "./poetry.js";
import {
  appendEvent,
  cleanupRuntimeFiles,
  clearResultFile,
  ensureStateDir,
  readJsonSync,
  replaceSession,
  sessionFile,
  stopFile,
  writePid
} from "./state.js";

const windowPollMs = 800;

async function safeActiveWindow() {
  try {
    return await activeWindow({
      accessibilityPermission: false,
      screenRecordingPermission: false
    });
  } catch {
    return undefined;
  }
}

function isIgnoredWindow(currentWindow) {
  const title = `${currentWindow?.title ?? ""}`.toLowerCase();
  const ownerName = `${currentWindow?.owner?.name ?? ""}`.toLowerCase();
  const ownerPath = `${currentWindow?.owner?.path ?? ""}`.toLowerCase();

  return [title, ownerName, ownerPath].some(
    (value) =>
      value.includes("winkeyserver") ||
      value.includes("node-global-key-listener") ||
      value.includes("\\emolitter\\") ||
      value.includes("\\emoletter\\")
  );
}

export async function spawnDetachedListener(sessionOptions) {
  await ensureStateDir();
  await cleanupRuntimeFiles();
  await clearResultFile();

  const entryPath = fileURLToPath(new URL("./listener-runner.js", import.meta.url));
  const payload = JSON.stringify(normalizeSession(sessionOptions));
  const child = spawn(process.execPath, [entryPath, payload], {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
}

export async function runListener(sessionOptions) {
  await ensureStateDir();
  await clearResultFile();
  const sessionId = crypto.randomUUID();
  const safeSession = normalizeSession(sessionOptions);

  await writePid(process.pid);
  await replaceSession({
    ...safeSession,
    startedAt: new Date().toISOString(),
    sessionId
  });
  await appendEvent(`你铺开了一张看不见的信纸，决定把今天写给「${safeSession.recipient}」。`);

  const keyboard = new GlobalKeyboardListener();
  let closed = false;
  let windowTimer;

  const isCurrentSession = () => {
    const session = readJsonSync(sessionFile);
    return session?.sessionId === sessionId;
  };

  const stopWithoutFinalizing = () => {
    if (closed) {
      return;
    }

    closed = true;
    try {
      keyboard.kill();
    } catch {
      // Ignore listener shutdown issues for stale sessions.
    }

    clearInterval(windowTimer);
    process.exit(0);
  };

  keyboard.addListener(async (event) => {
    if (!isCurrentSession()) {
      stopWithoutFinalizing();
      return;
    }

    if (event.state !== "DOWN") {
      return;
    }

    const description = describeKeyEvent(event);
    if (description) {
      await appendEvent(description);
    }
  });

  let lastWindowSignature = "";

  const stopAndFinalize = async () => {
    if (closed) {
      return;
    }

    closed = true;
    try {
      keyboard.kill();
    } catch {
      // Ignore listener shutdown issues during cleanup.
    }

    clearInterval(windowTimer);
    await finalizeLetter();
    process.exit(0);
  };

  windowTimer = setInterval(async () => {
    if (!isCurrentSession()) {
      stopWithoutFinalizing();
      return;
    }

    if (fs.existsSync(stopFile)) {
      await stopAndFinalize();
      return;
    }

    const current = await safeActiveWindow();
    if (!current || isIgnoredWindow(current)) {
      return;
    }

    const title = current?.title?.trim() ?? "";
    const appName = current?.owner?.name?.trim() ?? "";
    const signature = `${appName}::${title}`;

    if (!title && !appName) {
      return;
    }

    if (signature !== lastWindowSignature) {
      lastWindowSignature = signature;
      await appendEvent(describeWindow(title, appName));
    }
  }, windowPollMs);

  const gracefulExit = async () => {
    await stopAndFinalize();
  };

  process.on("SIGINT", gracefulExit);
  process.on("SIGTERM", gracefulExit);
}
