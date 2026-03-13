import fs from "node:fs";
import readline from "node:readline/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {stdin as input, stdout as output, argv, exit} from "node:process";
import {
  buildLetterText,
  getSupportedVoices,
  isSupportedVoice,
  finalizeLetter,
  readResultSync,
  writeLetter
} from "./letter.js";
import {spawnDetachedListener} from "./listener.js";
import {
  ensureStateDir,
  isProcessRunning,
  loadEventsSync,
  readJsonSync,
  readPidSync,
  resultFile,
  sessionFile,
  stopFile,
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

const stopWaitMs = 15_000;

async function emitLine(message) {
  output.write(`${message}\n`);
  await new Promise((resolve) => setTimeout(resolve, 30));
}

function printHelp() {
  console.log(`emo - 把你的桌面日常写成一封能读下去的信

用法:
  emo open [--to 收信人] [--voice gentle|cinematic|minimal]
  emo close [--stdout]
  emo status
  emo sample [--to 收信人] [--voice gentle|cinematic|minimal] [--theme maker|office|midnight] [--stdout]
  emo showcase [--to 收信人] [--theme maker|office|midnight] [--dir 输出目录]

命令:
  open      启动后台监听
  close     停止监听并生成书信
  status    查看当前记录状态
  sample    生成一封演示样张，适合预览和分享
  showcase  一键导出展示素材包
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

function readVoice(args) {
  const voice = getOptionValue(args, "--voice") ?? "gentle";
  if (!isSupportedVoice(voice)) {
    throw new Error(`不支持的 voice：${voice}。可选值：${getSupportedVoices().join(" / ")}`);
  }

  return voice;
}

function readTheme(args) {
  const theme = getOptionValue(args, "--theme") ?? "maker";
  if (!isSupportedSampleTheme(theme)) {
    throw new Error(`不支持的 theme：${theme}。可选值：${getSampleThemes().join(" / ")}`);
  }

  return theme;
}

async function promptRecipient() {
  const rl = readline.createInterface({input, output});
  try {
    const answer = await rl.question("你想给什么人写信？ ");
    return answer.trim() || "未署名的人";
  } finally {
    rl.close();
  }
}

async function printLetterFromPath(outputPath) {
  if (!outputPath || !fs.existsSync(outputPath)) {
    return;
  }

  const content = await fs.promises.readFile(outputPath, "utf8");
  console.log("");
  console.log(content);
}

async function openCommand(args) {
  await ensureStateDir();
  const pid = readPidSync();
  if (pid && (await isProcessRunning(pid))) {
    console.log("监听已经在运行中，请先执行 emo close。");
    return 1;
  }

  const recipient = getOptionValue(args, "--to") ?? (await promptRecipient());
  const voice = readVoice(args);
  await emitLine(`正在后台替你准备写给「${recipient}」的信，风格是「${voice}」。`);
  await spawnDetachedListener({recipient, voice});
  return 0;
}

async function closeCommand(args) {
  await ensureStateDir();
  const pid = readPidSync();
  const shouldPrint = hasFlag(args, "--stdout");

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
      console.log(`监听已恢复收尾，信件已放到桌面：${fallbackOutput}`);
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
    console.log(`信已经替你写好，安静地放在桌面上：${result.outputPath}`);
    if (shouldPrint) {
      if (result.preview) {
        console.log("");
        console.log(result.preview);
      } else {
        await printLetterFromPath(result.outputPath);
      }
    }
    return 0;
  }

  const fallbackOutput = await finalizeLetter();
  if (fallbackOutput) {
    console.log(`信已经替你写好，安静地放在桌面上：${fallbackOutput}`);
    if (shouldPrint) {
      await printLetterFromPath(fallbackOutput);
    }
    return 0;
  }

  console.log("监听已经结束，但没有找到可生成的书信内容。");
  return 1;
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

async function statusCommand() {
  await ensureStateDir();
  const session = readJsonSync(sessionFile);
  const pid = readPidSync();
  const eventCount = loadEventsSync().length;
  const running = pid ? await isProcessRunning(pid) : false;

  if (!session || !running) {
    console.log("当前没有正在进行的记录。");
    return 0;
  }

  console.log(`状态：记录中`);
  console.log(`收信人：${session.recipient}`);
  console.log(`风格：${session.voice ?? "gentle"}`);
  console.log(`开始时间：${session.startedAt}`);
  console.log(`已记录事件：${eventCount}`);
  return 0;
}

async function sampleCommand(args) {
  const recipient = getOptionValue(args, "--to") ?? "未来的我";
  const voice = readVoice(args);
  const theme = readTheme(args);
  const shouldPrint = hasFlag(args, "--stdout");
  const session = createSampleSession({recipient, voice, theme});
  const events = createSampleEvents({recipient, theme});
  const {outputPath, letterText} = await writeLetter(session, events, {prefix: "样张"});

  console.log(`已生成样张：${outputPath}`);
  console.log(`主题：${getSampleThemeLabel(theme)} | 风格：${voice}`);

  if (shouldPrint) {
    console.log("");
    console.log(letterText);
  }

  return 0;
}

async function showcaseCommand(args) {
  const recipient = getOptionValue(args, "--to") ?? "未来的我";
  const theme = readTheme(args);
  const outputDir = getOptionValue(args, "--dir") ?? undefined;
  const bundle = await createShowcaseBundle({recipient, theme, outputDir});

  console.log(`已生成展示包：${bundle.outputDir}`);
  console.log("包含内容：");
  console.log("- 3 封不同 voice 的样张信");
  console.log("- 1 份首页可引用摘录");
  console.log("- 1 份封面标题候选");
  console.log("- 1 份可直接发帖的中文文案");
  console.log(`总览文件：${bundle.summaryPath}`);
  return 0;
}

export async function main(args = argv.slice(2)) {
  const [command, ...rest] = args;

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return 0;
  }

  try {
    if (command === "open") {
      return openCommand(rest);
    }

    if (command === "close") {
      return closeCommand(rest);
    }

    if (command === "status") {
      return statusCommand();
    }

    if (command === "sample") {
      return sampleCommand(rest);
    }

    if (command === "showcase") {
      return showcaseCommand(rest);
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
