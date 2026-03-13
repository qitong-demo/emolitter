import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {argv, exit} from "node:process";
import {
  finalizeLetter,
  getLengthLabel,
  getRecipientKindLabel,
  getSupportedLengths,
  getSupportedRecipientKinds,
  getSupportedVoices,
  getVoiceLabel,
  isSupportedLength,
  isSupportedRecipientKind,
  isSupportedVoice,
  normalizeSession,
  readResultSync,
  writeLetter
} from "./letter.js";
import {spawnDetachedListener} from "./listener.js";
import {
  clearPersistentFiles,
  clearResultFile,
  cleanupRuntimeFiles,
  ensureStateDir,
  isProcessRunning,
  loadEventsSync,
  readJsonSync,
  readPidSync,
  resultFile,
  sessionFile,
  stopFile,
  updateSession,
  waitForListenerToStop
} from "./state.js";
import {
  createSampleEvents,
  createSampleSession,
  getSampleThemeLabel,
  getSampleThemes,
  isSupportedSampleTheme
} from "./sample.js";
import {createShowcaseBundle} from "./showcase.js";
import {describeConfig, readConfigSync, resetConfig, updateConfig} from "./config.js";
import {describeHistoryItem, loadHistorySync} from "./history.js";
import {createMenuInterface, pauseMenu, promptInput, promptSelect, promptYesNo} from "./menu.js";
import {configFile as configPath, desktopDir, historyFile as historyPath, stateDir} from "./paths.js";
import {
  drawBox,
  palette,
  playLiteraryProgress,
  renderBrandHeader,
  renderDashboard,
  renderHistoryCard,
  renderLetterSummaryCard,
  renderPrivacyBoard,
  renderSelectionMenu,
  renderSettingsCard,
  tint,
  typewriter
} from "./ui.js";

const appVersion = "0.5.1";
const stopWaitMs = 15_000;

function printHelp() {
  console.log(`emo / emoletter - 把你的桌面日常写成一封能读下去的信

用法:
  emo                         进入中文菜单
  emoletter                   进入中文菜单
  emo open [--to 收信人] [--kind someone|self|future] [--voice gentle|cinematic|minimal] [--length short|standard|long] [--html] [--outdir 目录]
  emo close [--stdout] [--html]
  emo status
  emo history [--limit 数量]
  emo sample [--to 收信人] [--kind someone|self|future] [--voice gentle|cinematic|minimal] [--length short|standard|long] [--theme maker|office|midnight] [--stdout] [--html]
  emo showcase [--to 收信人] [--kind someone|self|future] [--length short|standard|long] [--theme maker|office|midnight] [--dir 输出目录]
  emo settings [--reset]
  emo privacy
  emo clear [--history] [--config] [--all]
`);
}

function hasFlag(args, flag) {
  return args.includes(flag);
}

function getOptionValue(args, name) {
  const index = args.findIndex((item) => item === name);
  if (index === -1) {
    return null;
  }

  return args[index + 1] ?? null;
}

function assertSupported(value, checker, label, allValues) {
  if (!checker(value)) {
    throw new Error(`不支持的 ${label}：${value}。可选值：${allValues.join(" / ")}`);
  }

  return value;
}

function readVoice(args, fallback) {
  return assertSupported(
    getOptionValue(args, "--voice") ?? fallback,
    isSupportedVoice,
    "voice",
    getSupportedVoices()
  );
}

function readLength(args, fallback) {
  return assertSupported(
    getOptionValue(args, "--length") ?? fallback,
    isSupportedLength,
    "length",
    getSupportedLengths()
  );
}

function readRecipientKind(args, fallback) {
  return assertSupported(
    getOptionValue(args, "--kind") ?? fallback,
    isSupportedRecipientKind,
    "kind",
    getSupportedRecipientKinds()
  );
}

function readTheme(args, fallback) {
  const theme = getOptionValue(args, "--theme") ?? fallback;
  if (!isSupportedSampleTheme(theme)) {
    throw new Error(`不支持的 theme：${theme}。可选值：${getSampleThemes().join(" / ")}`);
  }

  return theme;
}

function resolveSessionFromArgs(args, baseConfig = readConfigSync()) {
  return normalizeSession({
    recipient: getOptionValue(args, "--to") ?? baseConfig.recipient,
    recipientKind: readRecipientKind(args, baseConfig.recipientKind),
    voice: readVoice(args, baseConfig.voice),
    length: readLength(args, baseConfig.length),
    outputDir: getOptionValue(args, "--outdir") ?? baseConfig.outputDir,
    htmlExport: hasFlag(args, "--html") || baseConfig.htmlExport
  });
}

function lastEventSnapshot() {
  const events = loadEventsSync();
  return events.at(-1) ?? null;
}

function latestHistoryItem() {
  return loadHistorySync(1)[0] ?? null;
}

function renderResultCard(result) {
  return renderLetterSummaryCard({
    recipient: result.recipient,
    recipientKind: result.recipientKind,
    voice: result.voice,
    length: result.length,
    outputPath: result.outputPath,
    htmlPath: result.htmlPath,
    preview: result.preview
  });
}

async function printLetterFromPath(outputPath) {
  if (!outputPath || !fs.existsSync(outputPath)) {
    return;
  }

  const content = await fs.promises.readFile(outputPath, "utf8");
  console.log("");
  await typewriter("信纸已经展开，请慢慢读。", {color: palette.mist, speed: 9});
  console.log(content);
}

async function waitForResultFile(timeoutMs = 3_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = readResultSync();
    if (result?.outputPath) {
      return result;
    }

    if (!fs.existsSync(sessionFile) && !fs.existsSync(resultFile)) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      continue;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return readResultSync();
}

async function openCommand(args) {
  await ensureStateDir();
  const pid = readPidSync();
  if (pid && (await isProcessRunning(pid))) {
    console.log(tint("监听已经在运行中，请先执行 emo close。", palette.rosewood));
    return 1;
  }

  const session = resolveSessionFromArgs(args);
  await typewriter("✉️  今晚开始替你慢慢存信。", {color: palette.sage, speed: 10});
  console.log(drawBox("准备落笔", [
    `收信人  ${session.recipient} · ${getRecipientKindLabel(session.recipientKind)}`,
    `笔墨    ${getVoiceLabel(session.voice)} · ${getLengthLabel(session.length)}`,
    `去处    ${session.outputDir}${session.htmlExport ? " · 生成 HTML" : ""}`
  ]));
  await spawnDetachedListener(session);
  return 0;
}

async function closeCommand(args) {
  await ensureStateDir();
  const pid = readPidSync();
  const shouldPrint = hasFlag(args, "--stdout");
  const shouldExportHtml = hasFlag(args, "--html");

  if (shouldExportHtml) {
    await updateSession((session) => ({
      ...session,
      htmlExport: true
    }));
  }

  await playLiteraryProgress([
    "正在整理今日的碎碎念...",
    "正在为你封装这一刻的空气...",
    "信使已出发，穿越时空中..."
  ]);

  if (pid && (await isProcessRunning(pid))) {
    fs.writeFileSync(stopFile, new Date().toISOString(), "utf8");
    const stopped = await waitForListenerToStop(pid, stopWaitMs);
    if (!stopped) {
      console.log(tint("监听进程还没有优雅收尾，请稍后再试一次。", palette.rosewood));
      return 1;
    }
  } else if (fs.existsSync(sessionFile)) {
    const fallbackOutput = await finalizeLetter();
    if (fallbackOutput) {
      const result = readResultSync();
      console.log(renderResultCard(result ?? {outputPath: fallbackOutput, preview: ""}));
      if (shouldPrint) {
        await printLetterFromPath(fallbackOutput);
      }
      return 0;
    }
  } else {
    console.log(tint("当前没有正在进行的记录。", palette.rosewood));
    return 1;
  }

  const result = await waitForResultFile();
  if (result?.outputPath) {
    console.log(renderResultCard(result));
    if (shouldPrint) {
      console.log("");
      console.log(result.preview ?? "");
    }
    return 0;
  }

  const fallbackOutput = await finalizeLetter();
  if (fallbackOutput) {
    const fallbackResult = readResultSync();
    console.log(renderResultCard(fallbackResult ?? {outputPath: fallbackOutput, preview: ""}));
    if (shouldPrint) {
      await printLetterFromPath(fallbackOutput);
    }
    return 0;
  }

  console.log(tint("监听已经结束，但没有找到可生成的书信内容。", palette.rosewood));
  return 1;
}

async function statusCommand() {
  await ensureStateDir();
  const session = readJsonSync(sessionFile);
  const pid = readPidSync();
  const eventCount = loadEventsSync().length;
  const running = pid ? await isProcessRunning(pid) : false;
  const config = readConfigSync();

  console.log(renderBrandHeader(appVersion));
  console.log(renderDashboard({
    config,
    session,
    isRunning: running,
    eventCount,
    lastEvent: lastEventSnapshot(),
    lastHistoryItem: latestHistoryItem()
  }));

  const lastResult = readResultSync();
  if (!running && lastResult?.outputPath) {
    console.log("");
    console.log(renderResultCard(lastResult));
  }

  return 0;
}

async function historyCommand(args) {
  const limit = Number(getOptionValue(args, "--limit") ?? 6);
  const items = loadHistorySync(Number.isFinite(limit) && limit > 0 ? limit : 6);

  if (items.length === 0) {
    console.log(renderHistoryCard(["还没有历史记录，先写一封给未来的信吧。"]));
    return 0;
  }

  console.log(renderHistoryCard(items.map((item, index) => {
    const summary = describeHistoryItem(item, index).split("\n").join(" / ");
    return truncateHistoryLine(summary);
  })));
  return 0;
}

function truncateHistoryLine(value) {
  return value.length > 80 ? `${value.slice(0, 79)}…` : value;
}

async function sampleCommand(args) {
  const config = readConfigSync();
  const session = createSampleSession({
    recipient: getOptionValue(args, "--to") ?? config.recipient,
    recipientKind: readRecipientKind(args, config.recipientKind),
    voice: readVoice(args, config.voice),
    length: readLength(args, config.length),
    theme: readTheme(args, config.theme),
    outputDir: getOptionValue(args, "--outdir") ?? config.outputDir,
    htmlExport: hasFlag(args, "--html") || config.htmlExport
  });
  const theme = readTheme(args, config.theme);
  const shouldPrint = hasFlag(args, "--stdout");

  await playLiteraryProgress([
    "正在搭好样张的信纸...",
    "正在替你折叠这段情绪...",
    "样张已经有了呼吸。"
  ]);

  const events = createSampleEvents({recipient: session.recipient, theme});
  const {outputPath, htmlPath, letterText} = await writeLetter(session, events, {
    prefix: "样张",
    html: session.htmlExport,
    recordHistory: true,
    historyEntry: {
      source: "sample"
    }
  });

  console.log(renderResultCard({
    recipient: session.recipient,
    recipientKind: session.recipientKind,
    voice: session.voice,
    length: session.length,
    outputPath,
    htmlPath,
    preview: letterText
  }));
  console.log(drawBox("样张参数", [
    `主题  ${getSampleThemeLabel(theme)}`,
    `对象  ${getRecipientKindLabel(session.recipientKind)}`,
    `笔墨  ${getVoiceLabel(session.voice)} · ${getLengthLabel(session.length)}`
  ]));

  if (shouldPrint) {
    console.log("");
    await typewriter("预览已经落在你面前。", {color: palette.lavender, speed: 10});
    console.log(letterText);
  }

  return 0;
}

async function showcaseCommand(args) {
  const config = readConfigSync();
  const recipient = getOptionValue(args, "--to") ?? config.recipient;
  const recipientKind = readRecipientKind(args, config.recipientKind);
  const length = readLength(args, config.length);
  const theme = readTheme(args, config.theme);
  const outputDir = getOptionValue(args, "--dir") ?? undefined;

  await playLiteraryProgress([
    "正在替你装订展示册...",
    "正在挑选最适合被引用的句子...",
    "一整套展示包已经晾干。"
  ]);

  const bundle = await createShowcaseBundle({
    recipient,
    recipientKind,
    length,
    theme,
    outputDir
  });

  console.log(drawBox("展示素材包", [
    `收信人  ${recipient} · ${getRecipientKindLabel(recipientKind)}`,
    `主题    ${getSampleThemeLabel(theme)} · ${getLengthLabel(length)}`,
    `入口页  ${bundle.indexHtmlPath}`,
    `总览    ${bundle.summaryPath}`
  ]));
  return 0;
}

async function settingsCommand(args) {
  if (hasFlag(args, "--reset")) {
    await resetConfig();
    await typewriter("笔墨已经恢复成最初的样子。", {color: palette.sage, speed: 10});
    return 0;
  }

  console.log(renderSettingsCard(describeConfig().split("\n")));
  return 0;
}

async function privacyCommand() {
  console.log(renderPrivacyBoard());
  console.log("");
  console.log(tint("状态目录", palette.sage), stateDir);
  console.log(tint("配置文件", palette.sage), configPath);
  console.log(tint("历史记录", palette.sage), historyPath);
  return 0;
}

async function clearCommand(args) {
  const clearAll = hasFlag(args, "--all");
  const clearHistory = clearAll || hasFlag(args, "--history");
  const clearConfig = clearAll || hasFlag(args, "--config");

  await cleanupRuntimeFiles();
  await clearResultFile();
  await clearPersistentFiles({
    history: clearHistory,
    config: clearConfig
  });

  console.log(drawBox("清理完成", [
    "运行时数据已经收拾妥当。",
    clearHistory ? "历史记录也已经轻轻归零。" : "历史记录仍然为你保留着。",
    clearConfig ? "默认配置已经回到空白页。" : "默认配置还在，随时可以继续写。"
  ]));
  return 0;
}

function renderMenuScreen() {
  const config = readConfigSync();
  const session = readJsonSync(sessionFile);
  const pid = readPidSync();
  const lastHistoryItem = latestHistoryItem();

  return [
    renderBrandHeader(appVersion),
    "",
    renderDashboard({
      config,
      session,
      isRunning: Boolean(session && pid),
      eventCount: loadEventsSync().length,
      lastEvent: lastEventSnapshot(),
      lastHistoryItem
    })
  ].join("\n");
}

function renderMenuFrame(selectionMenu) {
  return [renderMenuScreen(), "", selectionMenu].join("\n");
}

async function menuStartRecording(rl) {
  const config = readConfigSync();
  const recipient = await promptInput(rl, "收信人", config.recipient);
  const recipientKind = await promptSelect(
    rl,
    "收信对象类型：",
    getSupportedRecipientKinds().map((value) => ({
      label: getRecipientKindLabel(value),
      value
    }))
  );
  const voice = await promptSelect(
    rl,
    "选择书信风格：",
    getSupportedVoices().map((value) => ({
      label: getVoiceLabel(value),
      value
    }))
  );
  const length = await promptSelect(
    rl,
    "选择篇幅：",
    getSupportedLengths().map((value) => ({
      label: getLengthLabel(value),
      value
    }))
  );
  const htmlExport = await promptYesNo(rl, "同时导出 HTML 展示页吗", config.htmlExport);
  await openCommand([
    "--to", recipient,
    "--kind", recipientKind,
    "--voice", voice,
    "--length", length,
    ...(htmlExport ? ["--html"] : [])
  ]);
}

async function menuGenerateSample(rl) {
  const config = readConfigSync();
  const recipient = await promptInput(rl, "收信人", config.recipient);
  const recipientKind = await promptSelect(
    rl,
    "收信对象类型：",
    getSupportedRecipientKinds().map((value) => ({
      label: getRecipientKindLabel(value),
      value
    }))
  );
  const voice = await promptSelect(
    rl,
    "选择书信风格：",
    getSupportedVoices().map((value) => ({
      label: getVoiceLabel(value),
      value
    }))
  );
  const length = await promptSelect(
    rl,
    "选择篇幅：",
    getSupportedLengths().map((value) => ({
      label: getLengthLabel(value),
      value
    }))
  );
  const theme = await promptSelect(
    rl,
    "选择样张主题：",
    getSampleThemes().map((value) => ({
      label: getSampleThemeLabel(value),
      value
    }))
  );
  const htmlExport = await promptYesNo(rl, "同时导出 HTML 展示页吗", config.htmlExport);
  await sampleCommand([
    "--to", recipient,
    "--kind", recipientKind,
    "--voice", voice,
    "--length", length,
    "--theme", theme,
    "--stdout",
    ...(htmlExport ? ["--html"] : [])
  ]);
}

async function menuShowcase(rl) {
  const config = readConfigSync();
  const recipient = await promptInput(rl, "收信人", config.recipient);
  const recipientKind = await promptSelect(
    rl,
    "收信对象类型：",
    getSupportedRecipientKinds().map((value) => ({
      label: getRecipientKindLabel(value),
      value
    }))
  );
  const length = await promptSelect(
    rl,
    "选择篇幅：",
    getSupportedLengths().map((value) => ({
      label: getLengthLabel(value),
      value
    }))
  );
  const theme = await promptSelect(
    rl,
    "选择展示主题：",
    getSampleThemes().map((value) => ({
      label: getSampleThemeLabel(value),
      value
    }))
  );
  await showcaseCommand([
    "--to", recipient,
    "--kind", recipientKind,
    "--length", length,
    "--theme", theme
  ]);
}

async function menuSettings(rl) {
  let done = false;
  while (!done) {
    const action = await promptSelect(rl, "笔墨设置", [
      {label: "修改默认收信人", detail: "给下一封信换个名字", value: "recipient"},
      {label: "修改收信对象类型", detail: "自己 / 某个人 / 未来", value: "kind"},
      {label: "修改默认风格", detail: "温柔 / 电影感 / 克制", value: "voice"},
      {label: "修改默认篇幅", detail: "短笺 / 标准 / 长信", value: "length"},
      {label: "修改默认主题", detail: "演示样张的默认场景", value: "theme"},
      {label: "修改输出目录", detail: "改变信纸落下的位置", value: "outdir"},
      {label: "切换 HTML 默认开关", detail: "自动导出展示页", value: "html"},
      {label: "恢复初始值", detail: "把笔墨还原成最初的样子", value: "reset"},
      {label: "返回上一级", detail: "", value: "back"}
    ], {
      renderScreen: (selectionMenu) => [
        renderMenuScreen(),
        "",
        renderSettingsCard(describeConfig().split("\n")),
        "",
        selectionMenu
      ].join("\n"),
      escapeValue: "back"
    });

    const current = readConfigSync();
    if (action === "recipient") {
      await updateConfig({recipient: await promptInput(rl, "新的默认收信人", current.recipient)});
    } else if (action === "kind") {
      await updateConfig({
        recipientKind: await promptSelect(rl, "新的默认收信对象类型：", getSupportedRecipientKinds().map((value) => ({
          label: getRecipientKindLabel(value),
          value
        })))
      });
    } else if (action === "voice") {
      await updateConfig({
        voice: await promptSelect(rl, "新的默认风格：", getSupportedVoices().map((value) => ({
          label: getVoiceLabel(value),
          value
        })))
      });
    } else if (action === "length") {
      await updateConfig({
        length: await promptSelect(rl, "新的默认篇幅：", getSupportedLengths().map((value) => ({
          label: getLengthLabel(value),
          value
        })))
      });
    } else if (action === "theme") {
      await updateConfig({
        theme: await promptSelect(rl, "新的默认主题：", getSampleThemes().map((value) => ({
          label: getSampleThemeLabel(value),
          value
        })))
      });
    } else if (action === "outdir") {
      await updateConfig({outputDir: await promptInput(rl, "新的默认输出目录", current.outputDir)});
    } else if (action === "html") {
      await updateConfig({htmlExport: !current.htmlExport});
    } else if (action === "reset") {
      await resetConfig();
    } else if (action === "back") {
      done = true;
    }
  }
}

async function menuClear(rl) {
  const action = await promptSelect(rl, "清理数据", [
    {label: "只清理运行时数据", detail: "保留历史与默认设置", value: "runtime"},
    {label: "运行时数据 + 历史记录", detail: "忘掉已经写过的信", value: "history"},
    {label: "运行时数据 + 默认配置", detail: "回到未设定的状态", value: "config"},
    {label: "全部清理", detail: "把这一切都收回空白页", value: "all"},
    {label: "返回上一级", detail: "", value: "back"}
  ], {
    renderScreen: renderMenuFrame,
    escapeValue: "back"
  });

  if (action === "runtime") {
    await clearCommand([]);
  } else if (action === "history") {
    await clearCommand(["--history"]);
  } else if (action === "config") {
    await clearCommand(["--config"]);
  } else if (action === "all") {
    await clearCommand(["--all"]);
  }
}

async function launchMenu() {
  const rl = createMenuInterface();
  try {
    console.clear();
    console.log(renderBrandHeader(appVersion));
    await typewriter("欢迎回来。今晚这台电脑想写点什么？", {color: palette.lavender, speed: 10});

    let shouldExit = false;
    while (!shouldExit) {
      const module = await promptSelect(rl, "今晚想做什么", [
        {label: "开始记录今天", detail: "在后台替你收集这一整天", value: "record"},
        {label: "查看与回顾", detail: "状态 / 历史 / 展示 / 隐私", value: "view"},
        {label: "调整默认设置", detail: "笔墨风格、篇幅和输出位置", value: "settings"},
        {label: "离开", detail: "让这封信先在心里停一会儿", value: "quit"}
      ], {
        renderScreen: renderMenuFrame,
        escapeValue: "quit"
      });

      console.log("");
      if (module === "record") {
        const action = await promptSelect(rl, "Record", [
          {label: "✉️  开始书写今日", detail: "在后台安静记下今天的轮廓", value: "open"},
          {label: "🕯️  结束并封存此刻", detail: "把今天折成一封信", value: "close"},
          {label: "🧪  生成演示样张", detail: "不开监听也能先看成品", value: "sample"},
          {label: "返回上一层", detail: "", value: "back"}
        ], {
          renderScreen: renderMenuFrame,
          escapeValue: "back"
        });
        if (action === "open") {
          await menuStartRecording(rl);
        } else if (action === "close") {
          await closeCommand([]);
        } else if (action === "sample") {
          await menuGenerateSample(rl);
        }
      } else if (module === "view") {
        const action = await promptSelect(rl, "View", [
          {label: "🪟  查看当前状态", detail: "看看今天的情绪空气", value: "status"},
          {label: "📜  翻阅往事", detail: "最近写过的信都在这里", value: "history"},
          {label: "🖼️  导出展示素材包", detail: "适合截图、发帖和录 GIF", value: "showcase"},
          {label: "🔐  隐私说明", detail: "看看它究竟记了什么", value: "privacy"},
          {label: "返回上一层", detail: "", value: "back"}
        ], {
          renderScreen: renderMenuFrame,
          escapeValue: "back"
        });
        if (action === "status") {
          await statusCommand();
        } else if (action === "history") {
          await historyCommand([]);
        } else if (action === "showcase") {
          await menuShowcase(rl);
        } else if (action === "privacy") {
          await privacyCommand();
        }
      } else if (module === "settings") {
        const action = await promptSelect(rl, "Settings", [
          {label: "⚙️  笔墨设置", detail: "调整默认收信人、风格、篇幅", value: "settings"},
          {label: "🧹  清理数据", detail: "把运行痕迹或旧记录收走", value: "clear"},
          {label: "返回上一层", detail: "", value: "back"}
        ], {
          renderScreen: renderMenuFrame,
          escapeValue: "back"
        });
        if (action === "settings") {
          await menuSettings(rl);
        } else if (action === "clear") {
          await menuClear(rl);
        }
      } else if (module === "quit") {
        shouldExit = true;
      }

      if (!shouldExit) {
        console.log("");
        await pauseMenu(rl);
      }
    }
  } finally {
    rl.close();
  }

  return 0;
}

export async function main(args = argv.slice(2)) {
  const [command, ...rest] = args;

  if (!command) {
    return launchMenu();
  }

  if (command === "--help" || command === "-h") {
    printHelp();
    return 0;
  }

  try {
    if (command === "menu") {
      return launchMenu();
    }
    if (command === "open") {
      return openCommand(rest);
    }
    if (command === "close") {
      return closeCommand(rest);
    }
    if (command === "status") {
      return statusCommand();
    }
    if (command === "history") {
      return historyCommand(rest);
    }
    if (command === "sample") {
      return sampleCommand(rest);
    }
    if (command === "showcase") {
      return showcaseCommand(rest);
    }
    if (command === "settings") {
      return settingsCommand(rest);
    }
    if (command === "privacy") {
      return privacyCommand();
    }
    if (command === "clear") {
      return clearCommand(rest);
    }
  } catch (error) {
    console.log(tint(error instanceof Error ? error.message : String(error), palette.rosewood));
    return 1;
  }

  printHelp();
  return 1;
}

const isDirectRun =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  const code = await main();
  exit(code);
}
