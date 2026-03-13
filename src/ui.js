import {stdout} from "node:process";
import {readConfigSync} from "./config.js";
import {getLengthLabel, getRecipientKindLabel, getVoiceLabel} from "./letter.js";

const palette = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  sage: "\u001b[38;2;148;166;144m",
  lavender: "\u001b[38;2;182;164;207m",
  cream: "\u001b[38;2;245;232;214m",
  amber: "\u001b[38;2;229;172;118m",
  rosewood: "\u001b[38;2;171;101;79m",
  mist: "\u001b[38;2;190;193;185m",
  ink: "\u001b[38;2;82;65;59m"
};

function tint(value, color) {
  return `${color}${value}${palette.reset}`;
}

function emphasize(value) {
  return `${palette.bold}${value}${palette.reset}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncate(value, maxLength) {
  const raw = String(value ?? "");
  return raw.length > maxLength ? `${raw.slice(0, maxLength - 1)}…` : raw;
}

function lineWidth() {
  return Math.max(Math.min(stdout.columns ?? 84, 96), 72);
}

function drawRule(label = "") {
  const width = lineWidth();
  const labelText = label ? ` ${label} ` : "";
  const pad = Math.max(width - labelText.length, 0);
  return `${palette.mist}${"─".repeat(Math.floor(pad / 2))}${labelText}${"─".repeat(Math.ceil(pad / 2))}${palette.reset}`;
}

function drawBox(title, lines) {
  const width = Math.min(lineWidth(), 92);
  const innerWidth = width - 4;
  const topLabel = title ? ` ${title} ` : "";
  const top = `╭${"─".repeat(Math.max(1, innerWidth - topLabel.length))}${topLabel}╮`;
  const body = lines
    .map((line) => `│ ${truncate(line, innerWidth - 1).padEnd(innerWidth - 1, " ")}│`)
    .join("\n");
  const bottom = `╰${"─".repeat(innerWidth)}╯`;
  return `${palette.mist}${top}${palette.reset}\n${body}\n${palette.mist}${bottom}${palette.reset}`;
}

function formatRecipientSnapshot(config = readConfigSync()) {
  if (config.recipientKind === "future") {
    return `${config.recipient}（T+365 天）`;
  }

  if (config.recipientKind === "self") {
    return `${config.recipient}（此刻）`;
  }

  return `${config.recipient}（某个人）`;
}

function describeAir(eventCount, isRunning) {
  const score = Math.min(96, 24 + eventCount * 7 + (isRunning ? 14 : 0));
  if (score < 35) {
    return {score, label: "微凉", dot: tint("•", palette.mist)};
  }
  if (score < 55) {
    return {score, label: "轻轻发亮", dot: tint("•", palette.sage)};
  }
  if (score < 75) {
    return {score, label: "温热", dot: tint("•", palette.lavender)};
  }

  return {score, label: "有余温", dot: tint("•", palette.amber)};
}

function describeRecentFlow({isRunning, lastEvent, lastHistoryItem}) {
  if (isRunning && lastEvent?.message) {
    return `${tint("•", palette.sage)} 正在记录 ${truncate(lastEvent.message, 54)}`;
  }

  if (lastHistoryItem?.summary) {
    return `${tint("•", palette.lavender)} 最近一封里写到：${truncate(lastHistoryItem.summary, 42)}`;
  }

  return `${tint("•", palette.mist)} 正静候下一阵风和下一封信`;
}

export function renderBrandHeader(version = "0.4.0") {
  const art = [
    `${tint("      .      .     .", palette.mist)}`,
    `${tint("  .      ___________      .", palette.mist)}`,
    `${tint("      /           /|", palette.cream)}   ${emphasize(tint("emoLitter", palette.sage))}`,
    `${tint("     /___________/ |", palette.cream)}   ${tint("写给未来的信", palette.lavender)}`,
    `${tint("     |           | /", palette.cream)}   ${tint(`v${version}`, palette.amber)}`,
    `${tint("     |___________|/", palette.cream)}`
  ];

  return `${art.join("\n")}\n${drawRule("not a time tracker / a letter from your digital day")}`;
}

export function renderDashboard({config, session, isRunning, eventCount, lastEvent, lastHistoryItem}) {
  const current = session ?? config;
  const air = describeAir(eventCount, isRunning);
  const statusLines = [
    `${tint("默认收信人", palette.sage)}  ${formatRecipientSnapshot(config)}`,
    `${tint("当前笔墨", palette.sage)}  ${getVoiceLabel(current.voice)} / ${getLengthLabel(current.length)} / ${current.htmlExport ? "HTML 开启" : "HTML 关闭"}`,
    `${tint("情绪空气值", palette.sage)}  ${air.dot} ${air.score} / 100 · ${air.label}`,
    `${tint("实时流", palette.sage)}  ${describeRecentFlow({isRunning, lastEvent, lastHistoryItem})}`
  ];

  const recordLines = [
    `${tint("[R]", palette.amber)} ${emphasize("Record")}`,
    "✉️  开始书写今日",
    "🕯️  结束并封存此刻",
    "🧪  生成一封演示样张"
  ];
  const viewLines = [
    `${tint("[V]", palette.lavender)} ${emphasize("View")}`,
    "📜  翻阅往事",
    "🪟  查看当前状态",
    "🖼️  导出展示素材包"
  ];
  const settingLines = [
    `${tint("[S]", palette.sage)} ${emphasize("Settings")}`,
    "⚙️  笔墨设置",
    "🔐  隐私说明",
    "🧹  清理数据"
  ];

  return [
    drawBox("情绪仪表盘", statusLines),
    "",
    drawBox("模块导航", [
      `${truncate(recordLines.join("   "), 78)}`,
      `${truncate(viewLines.join("   "), 78)}`,
      `${truncate(settingLines.join("   "), 78)}`,
      `${tint("[Q]", palette.mist)} 退出`
    ])
  ].join("\n");
}

export async function typewriter(text, options = {}) {
  const color = options.color ?? "";
  const speed = options.speed ?? 12;
  for (const char of String(text)) {
    stdout.write(`${color}${char}${palette.reset}`);
    await sleep(speed);
  }
  stdout.write("\n");
}

export async function playLiteraryProgress(lines) {
  for (const line of lines) {
    await typewriter(line, {color: palette.mist, speed: 8});
    await sleep(90);
  }
}

export function renderLetterSummaryCard({recipient, recipientKind, voice, length, outputPath, htmlPath, preview}) {
  const snippet = String(preview ?? "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(1, 4)
    .join(" ");

  return drawBox("信件摘要", [
    `${tint("收信人", palette.sage)}  ${recipient} · ${getRecipientKindLabel(recipientKind ?? "someone")}`,
    `${tint("风格", palette.sage)}  ${getVoiceLabel(voice ?? "gentle")} · ${getLengthLabel(length ?? "standard")}`,
    `${tint("文本文件", palette.sage)}  ${truncate(outputPath ?? "未生成", 58)}`,
    htmlPath ? `${tint("展示页", palette.sage)}  ${truncate(htmlPath, 58)}` : `${tint("展示页", palette.sage)}  暂未导出 HTML`,
    `${tint("摘录", palette.sage)}  ${truncate(snippet || "这封信还很安静。", 58)}`
  ]);
}

export function renderPrivacyBoard() {
  return drawBox("透明化看板", [
    `${tint("💡 你的笔迹仅保存在", palette.sage)}  ~/.emolitter/`,
    `${tint("🔐 隐私承诺", palette.sage)}  我们只记下动作轮廓和窗口标题，不记下你具体键入的内容。`,
    `${tint("🪟 当前版本", palette.sage)}  监听、整理、生成都在本机完成，不会主动上传云端。`
  ]);
}

export function renderSettingsCard(lines) {
  return drawBox("笔墨设置", lines);
}

export function renderHistoryCard(lines) {
  return drawBox("翻阅往事", lines);
}

export function menuPrompt(label) {
  return `${tint(label, palette.cream)} `;
}

export {drawBox, drawRule, palette, sleep, tint};
