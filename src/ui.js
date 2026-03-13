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
  mist: "\u001b[38;2;190;193;185m"
};

const ansiPattern = /\u001b\[[0-9;]*m/gu;

function tint(value, color) {
  return `${color}${value}${palette.reset}`;
}

function emphasize(value) {
  return `${palette.bold}${value}${palette.reset}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripAnsi(value) {
  return String(value ?? "").replaceAll(ansiPattern, "");
}

function charWidth(char) {
  const codePoint = char.codePointAt(0) ?? 0;
  if (
    codePoint >= 0x1100 &&
    (
      codePoint <= 0x115f ||
      codePoint === 0x2329 ||
      codePoint === 0x232a ||
      (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
      (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
      (codePoint >= 0xff00 && codePoint <= 0xff60) ||
      (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
      (codePoint >= 0x1f300 && codePoint <= 0x1faff)
    )
  ) {
    return 2;
  }

  return 1;
}

function visibleWidth(value) {
  let width = 0;
  for (const char of stripAnsi(value)) {
    width += charWidth(char);
  }
  return width;
}

function fitLine(value, targetWidth) {
  let width = 0;
  let output = "";
  const raw = stripAnsi(value);

  for (const char of raw) {
    const next = charWidth(char);
    if (width + next > targetWidth - 1) {
      output += "…";
      width += 1;
      break;
    }

    output += char;
    width += next;
  }

  if (width < targetWidth) {
    output += " ".repeat(targetWidth - width);
  }

  return output;
}

function lineWidth() {
  return Math.max(Math.min(stdout.columns ?? 84, 90), 68);
}

function drawRule(label = "") {
  const width = lineWidth();
  const rawLabel = label ? ` ${label} ` : "";
  const labelWidth = visibleWidth(rawLabel);
  const remaining = Math.max(width - labelWidth, 0);
  return `${palette.mist}${"─".repeat(Math.floor(remaining / 2))}${rawLabel}${"─".repeat(Math.ceil(remaining / 2))}${palette.reset}`;
}

function drawBox(title, lines) {
  const width = Math.min(lineWidth(), 88);
  const innerWidth = width - 4;
  const top = `╭${"─".repeat(innerWidth + 2)}╮`;
  const bottom = `╰${"─".repeat(innerWidth + 2)}╯`;
  const body = [];

  if (title) {
    body.push(`│ ${fitLine(title, innerWidth)} │`);
    body.push(`│ ${" ".repeat(innerWidth)} │`);
  }

  for (const line of lines) {
    body.push(`│ ${fitLine(line, innerWidth)} │`);
  }

  return [
    tint(top, palette.mist),
    ...body,
    tint(bottom, palette.mist)
  ].join("\n");
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
    return {score, label: "微凉", dot: "•"};
  }
  if (score < 55) {
    return {score, label: "轻轻发亮", dot: "•"};
  }
  if (score < 75) {
    return {score, label: "温热", dot: "•"};
  }

  return {score, label: "有余温", dot: "•"};
}

function describeRecentFlow({isRunning, lastEvent, lastHistoryItem}) {
  if (isRunning && lastEvent?.message) {
    return `正在记录：${stripAnsi(lastEvent.message)}`;
  }

  if (lastHistoryItem?.summary) {
    return `最近一封里写到：${lastHistoryItem.summary}`;
  }

  return "正静候下一阵风和下一封信";
}

export function renderBrandHeader(version = "0.5.0") {
  const art = [
    tint("      .      .     .", palette.mist),
    tint("  .      ___________      .", palette.mist),
    `${tint("      /           /|", palette.cream)}   ${emphasize(tint("emoLitter", palette.sage))}`,
    `${tint("     /___________/ |", palette.cream)}   ${tint("写给未来的信", palette.lavender)}`,
    `${tint("     |           | /", palette.cream)}   ${tint(`v${version}`, palette.amber)}`,
    tint("     |___________|/", palette.cream)
  ];

  return `${art.join("\n")}\n${drawRule("not a time tracker / a letter from your digital day")}`;
}

export function renderDashboard({config, session, isRunning, eventCount, lastEvent, lastHistoryItem}) {
  const current = session ?? config;
  const air = describeAir(eventCount, isRunning);

  return [
    drawBox("情绪仪表盘", [
      `默认收信人  ${formatRecipientSnapshot(config)}`,
      `当前笔墨    ${getVoiceLabel(current.voice)} / ${getLengthLabel(current.length)} / ${current.htmlExport ? "HTML 开启" : "HTML 关闭"}`,
      `情绪空气值  ${air.dot} ${air.score} / 100 · ${air.label}`,
      `实时流      ${describeRecentFlow({isRunning, lastEvent, lastHistoryItem})}`
    ]),
    "",
    drawBox("模块导航", [
      "[R] Record    开始书写今日 / 结束并封存此刻 / 生成演示样张",
      "[V] View      查看状态 / 翻阅往事 / 导出展示素材包 / 隐私说明",
      "[S] Settings  修改默认设置 / 清理数据",
      "[Q] Quit      退出"
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
    `收信人   ${recipient} · ${getRecipientKindLabel(recipientKind ?? "someone")}`,
    `风格     ${getVoiceLabel(voice ?? "gentle")} · ${getLengthLabel(length ?? "standard")}`,
    `文本文件 ${outputPath ?? "未生成"}`,
    `展示页   ${htmlPath ?? "暂未导出 HTML"}`,
    `摘录     ${snippet || "这封信还很安静。"}`
  ]);
}

export function renderPrivacyBoard() {
  return drawBox("透明化看板", [
    "💡 你的笔迹仅保存在  ~/.emolitter/",
    "🔐 隐私承诺  我们只记下动作轮廓和窗口标题，不记下你具体键入的内容。",
    "🪟 当前版本  监听、整理、生成都在本机完成，不会主动上传云端。"
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
