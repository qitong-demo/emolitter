import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import {desktopDir} from "./paths.js";
import {
  cleanupRuntimeFiles,
  loadEventsSync,
  readJsonSync,
  resultFile,
  sessionFile,
  writeJson
} from "./state.js";

function sanitizeFilename(value, fallback) {
  const cleaned = value
    .replace(/[<>:"/\\|?*\r\n]+/gu, "")
    .replace(/\s+/gu, "_")
    .trim();

  return cleaned.slice(0, 24) || fallback;
}

function summarizeEvents(events) {
  if (events.length === 0) {
    return "静默片段";
  }

  const lastMessage = String(events.at(-1).message ?? "");
  const summary = lastMessage
    .replace(/[，。、「」“”‘’：:!！?？[\]()（）]/gu, "")
    .replace(/你/gu, "")
    .trim();

  return sanitizeFilename(summary.slice(0, 10), "心事片段");
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }
  return date.toLocaleTimeString("zh-CN", {hour12: false});
}

function formatDateStamp(value) {
  const date = new Date(value);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  const day = String(safeDate.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function buildLetterText(session, events) {
  const lines = [`致亲爱的${session.recipient}：`, ""];

  if (events.length === 0) {
    lines.push("今天的电脑没有留下太多动静，只剩一点温柔的空白。");
  } else {
    for (const event of events) {
      lines.push(`[${formatTime(event.timestamp)}] ${event.message}`);
    }
  }

  lines.push("");
  lines.push("此致");
  lines.push("敬礼");
  lines.push(new Date().toLocaleString("zh-CN", {hour12: false}));

  return `${lines.join("\n")}\n`;
}

export async function finalizeLetter() {
  const session = readJsonSync(sessionFile);
  if (!session) {
    return null;
  }

  const events = loadEventsSync();
  const letterText = buildLetterText(session, events);
  const fileName = `致${sanitizeFilename(session.recipient ?? "未署名的人", "未署名的人")}_${formatDateStamp(session.startedAt)}_${summarizeEvents(events)}.txt`;
  const outputPath = path.join(desktopDir(), fileName);

  await fsp.writeFile(outputPath, letterText, "utf8");
  await writeJson(resultFile, {
    outputPath,
    generatedAt: new Date().toISOString(),
    recipient: session.recipient
  });
  await cleanupRuntimeFiles();
  return outputPath;
}

export function readResultSync() {
  return fs.existsSync(resultFile) ? readJsonSync(resultFile) : null;
}
