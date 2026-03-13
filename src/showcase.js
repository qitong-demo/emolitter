import path from "node:path";
import fsp from "node:fs/promises";
import {writeLetter, getLengthLabel, getRecipientKindLabel, getVoiceLabel} from "./letter.js";
import {createSampleEvents, createSampleSession, getSampleThemeLabel} from "./sample.js";

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

function buildSocialCopy(recipient, themeLabel, recipientKind, length) {
  return [
    "我做了一个有点奇怪的小工具。",
    "",
    "它会记录我在电脑前的一段日常, 但最后给我的不是统计图, 而是一封信。",
    "",
    `这次我用「${themeLabel}」主题、${getRecipientKindLabel(recipientKind)}、${getLengthLabel(length)}，把这段桌面日常写给了「${recipient}」。`,
    "",
    "它叫 emoletter。"
  ].join("\n");
}

function buildTerminalDemo({recipient, theme, dirName}) {
  return [
    `$ emo showcase --to "${recipient}" --theme ${theme}`,
    "",
    `已生成展示包：${dirName}`,
    "包含内容：",
    "- 3 封不同 voice 的样张信",
    "- 3 个 HTML 展示页",
    "- 1 个 index.html 总览页",
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

function renderIndexHtml({recipient, themeLabel, generated}) {
  const cards = generated
    .map(({voice, txtName, htmlName, excerpt}) => {
      return `<article class="card">
        <p class="eyebrow">${getVoiceLabel(voice)}</p>
        <h2>${voice}</h2>
        <p>${excerpt.replace(/\n/gu, "<br>")}</p>
        <div class="links">
          <a href="./${htmlName}">打开 HTML</a>
          <a href="./${txtName}">查看 TXT</a>
        </div>
      </article>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>emoletter showcase</title>
    <style>
      :root {
        color-scheme: light;
        --bg: linear-gradient(160deg, #201817 0%, #6b3f2e 48%, #e6bc8c 100%);
        --panel: rgba(255, 249, 239, 0.9);
        --ink: #2f221d;
        --muted: #7d5c4d;
        --accent: #b86a47;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Noto Serif SC", "Songti SC", serif;
        background: var(--bg);
        color: var(--ink);
        padding: 40px 20px 72px;
      }
      main { max-width: 1100px; margin: 0 auto; }
      .hero {
        padding: 36px;
        border-radius: 28px;
        background: var(--panel);
        box-shadow: 0 24px 60px rgba(20, 12, 10, 0.24);
        margin-bottom: 28px;
      }
      .eyebrow {
        font-family: "IBM Plex Mono", monospace;
        color: var(--accent);
        font-size: 13px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1 { margin: 10px 0 8px; font-size: clamp(34px, 5vw, 58px); line-height: 1.05; }
      .grid { display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
      .card {
        background: rgba(255, 249, 239, 0.92);
        border-radius: 22px;
        padding: 26px;
        box-shadow: 0 16px 40px rgba(20, 12, 10, 0.16);
      }
      .card h2 { margin: 10px 0 10px; }
      .card p { color: var(--muted); line-height: 1.8; }
      .links { display: flex; gap: 12px; margin-top: 20px; flex-wrap: wrap; }
      a { color: var(--accent); text-decoration: none; font-weight: 600; }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <div class="eyebrow">emoletter showcase</div>
        <h1>给「${recipient}」的一组桌面来信</h1>
        <p>主题：${themeLabel}。这是一组可直接用于截图、录 GIF、写 README 和发帖的展示页。</p>
      </section>
      <section class="grid">
        ${cards}
      </section>
    </main>
  </body>
</html>`;
}

export async function createShowcaseBundle({
  recipient = "未来的我",
  recipientKind = "future",
  length = "standard",
  theme = "maker",
  outputDir
} = {}) {
  const dirName = outputDir ?? path.resolve(process.cwd(), `showcase-${toSlug(recipient)}-${theme}`);
  await fsp.mkdir(dirName, {recursive: true});

  const themeLabel = getSampleThemeLabel(theme);
  const voices = ["gentle", "cinematic", "minimal"];
  const generated = [];

  for (const voice of voices) {
    const session = createSampleSession({
      recipient,
      recipientKind,
      voice,
      length,
      theme,
      outputDir: dirName,
      htmlExport: true
    });
    const events = createSampleEvents({recipient, theme});
    const txtName = `${voice}-${theme}.txt`;
    const htmlName = `${voice}-${theme}.html`;
    const {letterText, outputPath, htmlPath} = await writeLetter(session, events, {
      outputPath: path.join(dirName, txtName),
      htmlPath: path.join(dirName, htmlName),
      html: true
    });
    generated.push({
      voice,
      outputPath,
      htmlPath,
      txtName,
      htmlName,
      excerpt: extractExcerpt(letterText)
    });
  }

  const excerpts = generated
    .map(({voice, excerpt}) => `## ${voice} / ${getVoiceLabel(voice)}\n\n> ${excerpt.replace(/\n/gu, "\n> ")}\n`)
    .join("\n");

  const coverTitles = buildCoverTitles(recipient)
    .map((title, index) => `${index + 1}. ${title}`)
    .join("\n");

  const socialCopy = buildSocialCopy(recipient, themeLabel, recipientKind, length);
  const summary = [
    "# emoletter Showcase Bundle",
    "",
    `收信人: ${recipient}`,
    `收信对象类型: ${getRecipientKindLabel(recipientKind)}`,
    `主题: ${themeLabel} (${theme})`,
    `篇幅: ${getLengthLabel(length)}`,
    "",
    "## 已生成的样张",
    ...generated.map(({voice, outputPath, htmlPath}) => `- ${voice}: ${outputPath} | ${htmlPath}`),
    "",
    "## 首页标题候选",
    coverTitles,
    "",
    "## 首页摘录",
    excerpts,
    "## 建议截图顺序",
    "1. 终端输入 emo showcase 命令",
    "2. 终端显示 bundle 已生成",
    "3. 打开 index.html 总览页",
    "4. 打开 cinematic 样张的开头",
    "5. 打开 gentle 样张的正文中段",
    "6. 打开 minimal 样张的结尾",
    "",
    "## 推荐社交文案",
    socialCopy
  ].join("\n");

  await fsp.writeFile(path.join(dirName, "README-snippets.md"), `${excerpts}\n`, "utf8");
  await fsp.writeFile(path.join(dirName, "cover-titles.txt"), `${coverTitles}\n`, "utf8");
  await fsp.writeFile(path.join(dirName, "social-copy.txt"), `${socialCopy}\n`, "utf8");
  await fsp.writeFile(path.join(dirName, "terminal-demo.txt"), `${buildTerminalDemo({recipient, theme, dirName})}\n`, "utf8");
  await fsp.writeFile(path.join(dirName, "SHOWCASE-README.md"), `${summary}\n`, "utf8");
  await fsp.writeFile(path.join(dirName, "index.html"), renderIndexHtml({recipient, themeLabel, generated}), "utf8");

  return {
    outputDir: dirName,
    files: generated.map(({outputPath}) => outputPath),
    htmlFiles: generated.map(({htmlPath}) => htmlPath),
    summaryPath: path.join(dirName, "SHOWCASE-README.md"),
    indexHtmlPath: path.join(dirName, "index.html")
  };
}
