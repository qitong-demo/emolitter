import readline from "node:readline";
import readlinePromises from "node:readline/promises";
import {stdin as input, stdout as output} from "node:process";
import {menuPrompt, palette, renderSelectionMenu, tint} from "./ui.js";

readline.emitKeypressEvents(input);

export function createMenuInterface() {
  return readlinePromises.createInterface({input, output});
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

function supportsArrowSelection() {
  return Boolean(input.isTTY && typeof input.setRawMode === "function");
}

async function promptSelectFallback(rl, title, options) {
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

export async function promptSelect(rl, title, options, settings = {}) {
  if (!supportsArrowSelection()) {
    return promptSelectFallback(rl, title, options);
  }

  const selectedFromValue = settings.initialValue
    ? options.findIndex((option) => option.value === settings.initialValue)
    : -1;
  let selectedIndex = selectedFromValue >= 0 ? selectedFromValue : Math.max(settings.initialIndex ?? 0, 0);

  const renderFrame = () => {
    if (typeof settings.renderScreen === "function") {
      console.clear();
      console.log(settings.renderScreen(renderSelectionMenu(title, options, selectedIndex, settings.footer)));
      return;
    }

    console.log(renderSelectionMenu(title, options, selectedIndex, settings.footer));
  };

  return new Promise((resolve) => {
    const previousRawMode = input.isRaw;

    const cleanup = (result) => {
      input.off("keypress", onKeypress);
      if (!previousRawMode) {
        input.setRawMode(false);
      }
      resolve(result);
    };

    const onKeypress = (_str, key = {}) => {
      if (key.name === "up") {
        selectedIndex = (selectedIndex - 1 + options.length) % options.length;
        renderFrame();
        return;
      }

      if (key.name === "down") {
        selectedIndex = (selectedIndex + 1) % options.length;
        renderFrame();
        return;
      }

      if (key.name === "return") {
        cleanup(options[selectedIndex].value);
        return;
      }

      if (key.name === "escape") {
        cleanup(settings.escapeValue ?? options.at(-1)?.value ?? options[0].value);
        return;
      }

      if (key.ctrl && key.name === "c") {
        cleanup(settings.escapeValue ?? options.at(-1)?.value ?? options[0].value);
      }
    };

    if (!previousRawMode) {
      input.setRawMode(true);
    }
    input.on("keypress", onKeypress);
    renderFrame();
  });
}

export async function pauseMenu(rl, message = "按回车继续，让情绪再停一会儿...") {
  await safeQuestion(rl, menuPrompt(message));
}
