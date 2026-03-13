import readline from "node:readline/promises";
import {stdin as input, stdout as output} from "node:process";

export function createMenuInterface() {
  return readline.createInterface({input, output});
}

export async function promptInput(rl, label, defaultValue = "") {
  const suffix = defaultValue ? ` (${defaultValue})` : "";
  const answer = await rl.question(`${label}${suffix}: `);
  const trimmed = answer.trim();
  return trimmed || defaultValue;
}

export async function promptYesNo(rl, label, defaultValue = true) {
  const hint = defaultValue ? "Y/n" : "y/N";
  const answer = (await rl.question(`${label} [${hint}]: `)).trim().toLowerCase();
  if (!answer) {
    return defaultValue;
  }

  return ["y", "yes", "1"].includes(answer);
}

export async function promptSelect(rl, title, options) {
  console.log(title);
  for (const [index, option] of options.entries()) {
    const detail = option.detail ? ` - ${option.detail}` : "";
    console.log(`${index + 1}. ${option.label}${detail}`);
  }

  while (true) {
    const raw = await rl.question("请选择编号: ");
    const index = Number(raw.trim());
    if (Number.isInteger(index) && index >= 1 && index <= options.length) {
      return options[index - 1].value;
    }

    console.log("输入无效，请重新输入。");
  }
}

export async function pauseMenu(rl, message = "按回车继续...") {
  await rl.question(`${message}`);
}
