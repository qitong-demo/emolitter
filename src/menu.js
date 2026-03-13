import readline from "node:readline/promises";
import {stdin as input, stdout as output} from "node:process";
import {menuPrompt, tint, palette} from "./ui.js";

export function createMenuInterface() {
  return readline.createInterface({input, output});
}

async function safeQuestion(rl, label) {
  try {
    return await rl.question(label);
  } catch (error) {
    if (error?.code === "ERR_USE_AFTER_CLOSE") {
      return null;
    }

    throw error;
  }
}

export async function promptInput(rl, label, defaultValue = "") {
  const suffix = defaultValue ? ` (${defaultValue})` : "";
  const answer = await safeQuestion(rl, menuPrompt(`${label}${suffix}:`));
  if (answer == null) {
    return defaultValue;
  }
  const trimmed = answer.trim();
  return trimmed || defaultValue;
}

export async function promptYesNo(rl, label, defaultValue = true) {
  const hint = defaultValue ? "Y/n" : "y/N";
  const raw = await safeQuestion(rl, menuPrompt(`${label} [${hint}]:`));
  if (raw == null) {
    return defaultValue;
  }
  const answer = raw.trim().toLowerCase();
  if (!answer) {
    return defaultValue;
  }

  return ["y", "yes", "1"].includes(answer);
}

export async function promptSelect(rl, title, options) {
  console.log(tint(title, palette.lavender));
  for (const [index, option] of options.entries()) {
    const detail = option.detail ? ` - ${option.detail}` : "";
    console.log(`${tint(`${index + 1}.`, palette.amber)} ${option.label}${detail}`);
  }

  while (true) {
    const raw = await safeQuestion(rl, menuPrompt("请选择编号"));
    if (raw == null) {
      return options.at(-1)?.value ?? options[0].value;
    }
    const index = Number(raw.trim());
    if (Number.isInteger(index) && index >= 1 && index <= options.length) {
      return options[index - 1].value;
    }

    console.log(tint("输入无效，请重新输入。", palette.rosewood));
  }
}

export async function promptHotkey(rl, title, options) {
  console.log(tint(title, palette.lavender));
  for (const option of options) {
    console.log(`${tint(`[${option.key}]`, palette.amber)} ${option.label}`);
  }

  while (true) {
    const raw = await safeQuestion(rl, menuPrompt("请输入字母"));
    if (raw == null) {
      return options.at(-1)?.value ?? options[0].value;
    }
    const key = raw.trim().toUpperCase();
    const matched = options.find((option) => option.key.toUpperCase() === key);
    if (matched) {
      return matched.value;
    }

    console.log(tint("没有这个选项，请再试一次。", palette.rosewood));
  }
}

export async function pauseMenu(rl, message = "按回车继续，让情绪再停一会儿...") {
  await safeQuestion(rl, menuPrompt(message));
}
