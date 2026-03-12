import fs from "node:fs";
import readline from "node:readline/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {stdin as input, stdout as output, argv, exit} from "node:process";
import {finalizeLetter, readResultSync} from "./letter.js";
import {spawnDetachedListener} from "./listener.js";
import {
  ensureStateDir,
  isProcessRunning,
  readPidSync,
  resultFile,
  sessionFile,
  stopFile,
  waitForListenerToStop
} from "./state.js";

const stopWaitMs = 15_000;

async function emitLine(message) {
  output.write(`${message}\n`);
  await new Promise((resolve) => setTimeout(resolve, 30));
}

function printHelp() {
  console.log(`emo - 把你的电脑操作写成一封带点文艺幽默的信

用法:
  emo open [--to 收信人]
  emo close

命令:
  open     启动后台监听
  close    停止监听并生成书信
`);
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

function getRecipient(args) {
  const toIndex = args.findIndex((item) => item === "--to");
  if (toIndex === -1) {
    return null;
  }

  return args[toIndex + 1] ?? null;
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

  const recipient = getRecipient(args) ?? (await promptRecipient());
  await emitLine(`正在后台替你准备写给「${recipient}」的信。`);
  await spawnDetachedListener(recipient);
  return 0;
}

async function closeCommand() {
  await ensureStateDir();
  const pid = readPidSync();

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
      return 0;
    }
  } else {
    console.log("当前没有正在进行的记录。");
    return 1;
  }

  const result = await waitForResultFile();
  if (result?.outputPath) {
    console.log(`信已经替你写好，安静地放在桌面上：${result.outputPath}`);
    return 0;
  }

  const fallbackOutput = await finalizeLetter();
  if (fallbackOutput) {
    console.log(`信已经替你写好，安静地放在桌面上：${fallbackOutput}`);
    return 0;
  }

  console.log("监听已经结束，但没有找到可生成的书信内容。");
  return 1;
}

export async function main(args = argv.slice(2)) {
  const [command, ...rest] = args;

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return 0;
  }

  if (command === "open") {
    return openCommand(rest);
  }

  if (command === "close") {
    return closeCommand();
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
