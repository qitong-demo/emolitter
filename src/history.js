import path from "node:path";
import {getLengthLabel, getRecipientKindLabel, getVoiceLabel} from "./letter.js";
import {historyFile} from "./paths.js";
import {appendJsonLine, readJsonLinesSync} from "./state.js";

function summarizePreview(preview) {
  if (!preview) {
    return "";
  }

  const lines = String(preview)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.slice(1, 4).join(" ").slice(0, 120);
}

export async function appendHistoryEntry(entry) {
  await appendJsonLine(historyFile, {
    ...entry,
    summary: entry.summary ?? summarizePreview(entry.preview)
  });
}

export function loadHistorySync(limit = 10) {
  const items = readJsonLinesSync(historyFile);
  return items.slice(-limit).reverse();
}

export function describeHistoryItem(item, index) {
  const output = item.outputPath ? path.basename(item.outputPath) : "未生成文件";
  const sourceLabel = item.source === "sample" ? "样张" : item.source === "live" ? "正式书信" : "书信";
  return [
    `${index + 1}. ${item.generatedAt ?? item.startedAt ?? "未知时间"}`,
    `   类型：${sourceLabel} | 收信人：${item.recipient} | 对象：${getRecipientKindLabel(item.recipientKind ?? "someone")} | 风格：${getVoiceLabel(item.voice ?? "gentle")} | 篇幅：${getLengthLabel(item.length ?? "standard")}`,
    `   文件：${output}`,
    item.summary ? `   摘要：${item.summary}` : null
  ]
    .filter(Boolean)
    .join("\n");
}
