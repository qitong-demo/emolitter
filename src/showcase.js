import path from "node:path";
import fsp from "node:fs/promises";
import {writeLetter} from "./letter.js";
import {createSampleEvents, createSampleSession, getSampleThemeLabel} from "./sample.js";

const voiceLabels = {
  gentle: "温柔",
  cinematic: "电影感",
  minimal: "克制"
};

function toSlug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gu, "-")
    .replace(/^-+|-+$/gu, "") || "showcase";
}

function buildCoverTitles(recipient) {
  return [
    "把你一天的桌面日常, 写成一封真正能读下去的信",
    "Not a time tracker. A letter from your digital day.",
    `我做了一个程序, 会把普通的电脑生活写成写给「${recipient}」的一封信`
  ];
}

function buildSocialCopy(recipient, themeLabel) {
  return [
    "我做了一个有点奇怪的小工具。",
    "",
    "它会记录我在电脑前的一段日常, 但最后给我的不是统计图, 而是一封信。",
    "",
    `这次我用「${themeLabel}」主题, 把这段桌面日常写给了「${recipient}」。`,
    "",
    "它叫 emolitter。"
  ].join("\n");
}

function buildTerminalDemo({recipient, theme, dirName}) {
  return [
    `$ emo showcase --to "${recipient}" --theme ${theme}`,
    "",
    `已生成展示包：${dirName}`,
    "包含内容：",
    "- 3 封不同 voice 的样张信",
    "- 1 份首页可引用摘录",
    "- 1 份封面标题候选",
    "- 1 份可直接发帖的中文文案"
  ].join("\n");
}

function extractExcerpt(letterText) {
  return letterText
    .split(/\r?\n/u)
    .filter(Boolean)
    .slice(2, 8)
    .join("\n");
}

export async function createShowcaseBundle({
  recipient = "未来的我",
  theme = "maker",
  outputDir
} = {}) {
  const dirName = outputDir ?? path.resolve(process.cwd(), `showcase-${toSlug(recipient)}-${theme}`);
  await fsp.mkdir(dirName, {recursive: true});

  const themeLabel = getSampleThemeLabel(theme);
  const voices = ["gentle", "cinematic", "minimal"];
  const generated = [];

  for (const voice of voices) {
    const session = createSampleSession({recipient, voice, theme});
    const events = createSampleEvents({recipient, theme});
    const outputPath = path.join(dirName, `${voice}-${theme}.txt`);
    const {letterText} = await writeLetter(session, events, {outputPath});
    generated.push({
      voice,
      label: voiceLabels[voice],
      outputPath,
      letterText
    });
  }

  const excerpts = generated
    .map(({voice, label, letterText}) => {
      return `## ${voice} / ${label}\n\n> ${extractExcerpt(letterText).replace(/\n/gu, "\n> ")}\n`;
    })
    .join("\n");

  const coverTitles = buildCoverTitles(recipient)
    .map((title, index) => `${index + 1}. ${title}`)
    .join("\n");

  const summary = [
    "# emolitter Showcase Bundle",
    "",
    `收信人: ${recipient}`,
    `主题: ${themeLabel} (${theme})`,
    "",
    "## 已生成的样张",
    ...generated.map(({voice, outputPath}) => `- ${voice}: ${outputPath}`),
    "",
    "## 首页标题候选",
    coverTitles,
    "",
    "## 首页摘录",
    excerpts,
    "## 建议截图顺序",
    "1. 终端输入 emo showcase 命令",
    "2. 终端显示 bundle 已生成",
    "3. 打开 cinematic 样张的开头",
    "4. 打开 gentle 样张的正文中段",
    "5. 打开 minimal 样张的结尾",
    "",
    "## 推荐社交文案",
    buildSocialCopy(recipient, themeLabel)
  ].join("\n");

  await fsp.writeFile(path.join(dirName, "README-snippets.md"), excerpts, "utf8");
  await fsp.writeFile(path.join(dirName, "cover-titles.txt"), `${coverTitles}\n`, "utf8");
  await fsp.writeFile(path.join(dirName, "social-copy.txt"), `${buildSocialCopy(recipient, themeLabel)}\n`, "utf8");
  await fsp.writeFile(
    path.join(dirName, "terminal-demo.txt"),
    `${buildTerminalDemo({recipient, theme, dirName})}\n`,
    "utf8"
  );
  await fsp.writeFile(path.join(dirName, "SHOWCASE-README.md"), `${summary}\n`, "utf8");

  return {
    outputDir: dirName,
    files: generated.map(({outputPath}) => outputPath),
    summaryPath: path.join(dirName, "SHOWCASE-README.md")
  };
}
