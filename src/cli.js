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
  configFile,
  ensureStateDir,
  historyFile,
  isProcessRunning,
  loadEventsSync,
  readJsonSync,
  readPidSync,
  replaceSession,
  resultFile,
  sessionFile,
  stopFile,
  updateSession,
  waitForListenerToStop,
  writeJson
} from "./state.js";
import {
  createSampleEvents,
  createSampleSession,
  getSampleThemeLabel,
  getSampleThemes,
  isSupportedSampleTheme
} from "./sample.js";
import {createShowcaseBundle} from "./showcase.js";
import {readConfigSync, updateConfig, resetConfig, describeConfig} from "./config.js";
import {describeHistoryItem, loadHistorySync} from "./history.js";
import {createMenuInterface, pauseMenu, promptInput, promptSelect, promptYesNo} from "./menu.js";
import {configFile as configPath, desktopDir, historyFile as historyPath, stateDir} from "./paths.js";

const stopWaitMs = 15_000;

function printHelp() {
  console.log(`emo - 把你的桌面日常写成一封能读下去的信

用法:
  emo                         进入中文菜单
  emo open [--to 收信人] [--kind someone|self|future] [--voice gentle|cinematic|minimal] [--length short|standard|long] [--html] [--outdir 目录]
  emo close [--stdout] [--html]
  emo status
  emo history [--limit 数量]
  emo sample [--to 收信人] [--kind someone|self|future] [--voice gentle|cinematic|minimal] [--length short|standard|long] [--theme maker|office|midnight] [--stdout] [--html]
  emo showcase [--to 收信人] [--kind someone|self|future] [--length short|standard|long] [--theme maker|office|midnight] [--dir 输出目录]
  emo settings [--reset]
  emo privacy
  emo clear [--history] [--config] [--all]

命令:
  open      启动后台监听
  close     停止监听并生成书信
  status    查看当前记录状态
  history   查看最近生成记录
  sample    生成演示样张
  showcase  一键导出展示素材包
  settings  查看或重置默认设置
  privacy   查看隐私说明
  clear     清理运行数据/历史/配置
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

async function printLetterFromPath(outputPath) {
  if (!outputPath || !fs.existsSync(outputPath)) {
    return;
  }

  const content = await fs.promises.readFile(outputPath, "utf8");
  console.log("");
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
    console.log("监听已经在运行中，请先执行 emo close。");
    return 1;
  }

  const session = resolveSessionFromArgs(args);
  console.log(`正在后台替你准备一封${getLengthLabel(session.length)}。`);
  console.log(`收信人：${session.recipient} | 类型：${getRecipientKindLabel(session.recipientKind)} | 风格：${getVoiceLabel(session.voice)}`);
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

  if (pid && (await isProcessRunning(pid))) {
    fs.writeFileSync(stopFile, new Date().toISOString(), "utf8");
    const stopped = await waitForListenerToStop(pid, stopWaitMs);
    if (!stopped) {
      console.log("监听进程还没有优雅收尾，请稍后再试一次。");
      return 1;
    }
  } else if (fs.existsSync(sessionFile)) {
    const fallbackOutput = await finalizeLetter();
    if (fallbackOutput) {
      const result = readResultSync();
      console.log(`监听已恢复收尾，信件已放到：${fallbackOutput}`);
      if (result?.htmlPath) {
        console.log(`HTML 展示页：${result.htmlPath}`);
      }
      if (shouldPrint) {
        await printLetterFromPath(fallbackOutput);
      }
      return 0;
    }
  } else {
    console.log("当前没有正在进行的记录。");
    return 1;
  }

  const result = await waitForResultFile();
  if (result?.outputPath) {
    console.log(`信已经替你写好：${result.outputPath}`);
    if (result.htmlPath) {
      console.log(`HTML 展示页：${result.htmlPath}`);
    }
    if (shouldPrint) {
      console.log("");
      console.log(result.preview ?? "");
    }
    return 0;
  }

  const fallbackOutput = await finalizeLetter();
  if (fallbackOutput) {
    const fallbackResult = readResultSync();
    console.log(`信已经替你写好：${fallbackOutput}`);
    if (fallbackResult?.htmlPath) {
      console.log(`HTML 展示页：${fallbackResult.htmlPath}`);
    }
    if (shouldPrint) {
      await printLetterFromPath(fallbackOutput);
    }
    return 0;
  }

  console.log("监听已经结束，但没有找到可生成的书信内容。");
  return 1;
}

async function statusCommand() {
  await ensureStateDir();
  const session = readJsonSync(sessionFile);
  const pid = readPidSync();
  const eventCount = loadEventsSync().length;
  const running = pid ? await isProcessRunning(pid) : false;
  const lastResult = readResultSync();

  if (!session || !running) {
    console.log("当前没有正在进行的记录。");
    if (lastResult?.outputPath) {
      console.log(`最近生成：${lastResult.outputPath}`);
    }
    return 0;
  }

  console.log("状态：记录中");
  console.log(`收信人：${session.recipient}`);
  console.log(`类型：${getRecipientKindLabel(session.recipientKind ?? "someone")}`);
  console.log(`风格：${getVoiceLabel(session.voice ?? "gentle")}`);
  console.log(`篇幅：${getLengthLabel(session.length ?? "standard")}`);
  console.log(`输出目录：${session.outputDir ?? desktopDir()}`);
  console.log(`自动导出 HTML：${session.htmlExport ? "是" : "否"}`);
  console.log(`开始时间：${session.startedAt}`);
  console.log(`已记录事件：${eventCount}`);
  return 0;
}

async function historyCommand(args) {
  const limit = Number(getOptionValue(args, "--limit") ?? 8);
  const items = loadHistorySync(Number.isFinite(limit) && limit > 0 ? limit : 8);

  if (items.length === 0) {
    console.log("还没有历史记录。");
    return 0;
  }

  console.log("最近的书信记录：");
  console.log("");
  for (const [index, item] of items.entries()) {
    console.log(describeHistoryItem(item, index));
    if (index !== items.length - 1) {
      console.log("");
    }
  }

  return 0;
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
  const events = createSampleEvents({recipient: session.recipient, theme});
  const {outputPath, htmlPath, letterText} = await writeLetter(session, events, {
    prefix: "样张",
    html: session.htmlExport,
    recordHistory: true,
    historyEntry: {
      source: "sample"
    }
  });

  console.log(`已生成样张：${outputPath}`);
  console.log(`类型：${getRecipientKindLabel(session.recipientKind)} | 风格：${getVoiceLabel(session.voice)} | 篇幅：${getLengthLabel(session.length)} | 主题：${getSampleThemeLabel(theme)}`);
  if (htmlPath) {
    console.log(`HTML 展示页：${htmlPath}`);
  }

  if (shouldPrint) {
    console.log("");
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
  const bundle = await createShowcaseBundle({
    recipient,
    recipientKind,
    length,
    theme,
    outputDir
  });

  console.log(`已生成展示包：${bundle.outputDir}`);
  console.log("包含内容：");
  console.log("- 3 封不同 voice 的样张信");
  console.log("- 3 个 HTML 展示页");
  console.log("- 1 个 index.html 总览页");
  console.log("- 1 份首页可引用摘录");
  console.log("- 1 份封面标题候选");
  console.log("- 1 份可直接发帖的中文文案");
  console.log(`总览文件：${bundle.summaryPath}`);
  console.log(`入口页面：${bundle.indexHtmlPath}`);
  return 0;
}

async function settingsCommand(args) {
  if (hasFlag(args, "--reset")) {
    await resetConfig();
    console.log("默认设置已恢复为初始值。");
    return 0;
  }

  console.log("当前默认设置：");
  console.log(describeConfig());
  return 0;
}

async function privacyCommand() {
  console.log("隐私说明");
  console.log("");
  console.log("1. 这是一个 local-first 工具，监听、整理、生成都在本机完成。");
  console.log("2. 运行时状态保存在以下目录：");
  console.log(`   - 状态目录：${stateDir}`);
  console.log(`   - 配置文件：${configPath}`);
  console.log(`   - 历史记录：${historyPath}`);
  console.log("3. 当前版本不会主动把你的内容上传到云端。");
  console.log("4. 你仍然应该只在自己信任的机器和环境中使用它。");
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

  console.log("已清理运行时数据。");
  if (clearHistory) {
    console.log("已清理历史记录。");
  }
  if (clearConfig) {
    console.log("已清理默认配置。");
  }
  return 0;
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
  let exitSettings = false;

  while (!exitSettings) {
    const current = readConfigSync();
    console.log("");
    console.log("当前默认设置：");
    console.log(describeConfig(current));
    console.log("");
    const action = await promptSelect(rl, "设置菜单：", [
      {label: "修改默认收信人", value: "recipient"},
      {label: "修改收信对象类型", value: "kind"},
      {label: "修改默认风格", value: "voice"},
      {label: "修改默认篇幅", value: "length"},
      {label: "修改默认样张主题", value: "theme"},
      {label: "修改默认输出目录", value: "outputDir"},
      {label: "切换默认 HTML 导出", value: "html"},
      {label: "恢复初始设置", value: "reset"},
      {label: "返回主菜单", value: "back"}
    ]);

    if (action === "recipient") {
      await updateConfig({recipient: await promptInput(rl, "新的默认收信人", current.recipient)});
    } else if (action === "kind") {
      await updateConfig({
        recipientKind: await promptSelect(
          rl,
          "新的默认收信对象类型：",
          getSupportedRecipientKinds().map((value) => ({
            label: getRecipientKindLabel(value),
            value
          }))
        )
      });
    } else if (action === "voice") {
      await updateConfig({
        voice: await promptSelect(
          rl,
          "新的默认风格：",
          getSupportedVoices().map((value) => ({
            label: getVoiceLabel(value),
            value
          }))
        )
      });
    } else if (action === "length") {
      await updateConfig({
        length: await promptSelect(
          rl,
          "新的默认篇幅：",
          getSupportedLengths().map((value) => ({
            label: getLengthLabel(value),
            value
          }))
        )
      });
    } else if (action === "theme") {
      await updateConfig({
        theme: await promptSelect(
          rl,
          "新的默认样张主题：",
          getSampleThemes().map((value) => ({
            label: getSampleThemeLabel(value),
            value
          }))
        )
      });
    } else if (action === "outputDir") {
      await updateConfig({outputDir: await promptInput(rl, "新的默认输出目录", current.outputDir)});
    } else if (action === "html") {
      await updateConfig({htmlExport: !current.htmlExport});
    } else if (action === "reset") {
      await resetConfig();
    } else if (action === "back") {
      exitSettings = true;
    }
  }
}

async function menuClear(rl) {
  const action = await promptSelect(rl, "清理哪些内容：", [
    {label: "只清理运行时数据", value: "runtime"},
    {label: "运行时数据 + 历史记录", value: "history"},
    {label: "运行时数据 + 默认配置", value: "config"},
    {label: "全部清理", value: "all"},
    {label: "返回", value: "back"}
  ]);

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
    let shouldExit = false;
    while (!shouldExit) {
      const config = readConfigSync();
      console.log("");
      console.log("emolitter 中文菜单");
      console.log("--------------------");
      console.log(`默认收信人：${config.recipient}`);
      console.log(`默认类型：${getRecipientKindLabel(config.recipientKind)} | 默认风格：${getVoiceLabel(config.voice)} | 默认篇幅：${getLengthLabel(config.length)}`);
      console.log("");

      const action = await promptSelect(rl, "请选择要执行的操作：", [
        {label: "开始记录今天", value: "open"},
        {label: "结束记录并生成书信", value: "close"},
        {label: "查看当前状态", value: "status"},
        {label: "生成演示样张", value: "sample"},
        {label: "导出展示素材包", value: "showcase"},
        {label: "查看历史记录", value: "history"},
        {label: "修改默认设置", value: "settings"},
        {label: "查看隐私说明", value: "privacy"},
        {label: "清理数据", value: "clear"},
        {label: "退出", value: "exit"}
      ]);

      console.log("");
      if (action === "open") {
        await menuStartRecording(rl);
      } else if (action === "close") {
        await closeCommand([]);
      } else if (action === "status") {
        await statusCommand();
      } else if (action === "sample") {
        await menuGenerateSample(rl);
      } else if (action === "showcase") {
        await menuShowcase(rl);
      } else if (action === "history") {
        await historyCommand([]);
      } else if (action === "settings") {
        await menuSettings(rl);
      } else if (action === "privacy") {
        await privacyCommand();
      } else if (action === "clear") {
        await menuClear(rl);
      } else if (action === "exit") {
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
    console.log(error instanceof Error ? error.message : String(error));
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
