import path from "node:path";
import {configFile, desktopDir} from "./paths.js";
import {getLengthLabel, getRecipientKindLabel, getVoiceLabel} from "./letter.js";
import {getSampleThemeLabel} from "./sample.js";
import {readJsonSync, writeJson} from "./state.js";

export const defaultConfig = {
  recipient: "未来的我",
  recipientKind: "future",
  voice: "gentle",
  length: "standard",
  theme: "maker",
  outputDir: desktopDir(),
  htmlExport: false
};

export function readConfigSync() {
  const stored = readJsonSync(configFile) ?? {};
  return {
    ...defaultConfig,
    ...stored
  };
}

export async function writeConfig(config) {
  const next = {
    ...defaultConfig,
    ...config,
    outputDir: path.resolve(config?.outputDir ?? defaultConfig.outputDir)
  };
  await writeJson(configFile, next);
  return next;
}

export async function updateConfig(patch) {
  const current = readConfigSync();
  return writeConfig({
    ...current,
    ...patch
  });
}

export async function resetConfig() {
  return writeConfig(defaultConfig);
}

export function describeConfig(config = readConfigSync()) {
  return [
    `默认收信对象：${config.recipient}`,
    `收信对象类型：${getRecipientKindLabel(config.recipientKind)}`,
    `默认风格：${getVoiceLabel(config.voice)}`,
    `默认篇幅：${getLengthLabel(config.length)}`,
    `默认样张主题：${getSampleThemeLabel(config.theme)}`,
    `默认输出目录：${config.outputDir}`,
    `默认导出 HTML：${config.htmlExport ? "是" : "否"}`
  ].join("\n");
}
