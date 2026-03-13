import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import {desktopDir} from "./paths.js";
import {
  cleanupRuntimeFiles,
  loadEventsSync,
  readJsonSync,
  resultFile,
  sessionFile,
  writeJson
} from "./state.js";

const maxLetterEvents = 10;
const maxParagraphEvents = 3;
const idleGapMs = 12 * 60 * 1000;

const voiceProfiles = {
  gentle: {
    label: "温柔",
    intro(session, startedAt) {
      return `见字如面，${session.recipient}。这封信写于${startedAt}之后，起初只是想把一天里散落在屏幕前的细碎动静，慢慢整理成几句能寄给你的话。`;
    },
    empty(recipient) {
      return `见字如面，${recipient}。今天我本来想从电脑边上给你捎几句近况，可屏幕安静得很，最后只剩下一点没有发出声响的心思。`;
    },
    range(firstPart, lastPart) {
      return `从${firstPart}到${lastPart}，我在窗口和键盘之间来回了一阵，也顺手把心绪留了下来。`;
    },
    single() {
      return "今天的动静不多，可我还是想把这一个小小片刻写给你。";
    },
    omitted(count) {
      return `中间其实还有 ${count} 个过于细小的动作，我没有逐条写进来，只把它们折成停顿，夹在下面这些句子里。`;
    },
    compression() {
      return "我尽量没有把它写成流水账，而是把那些零碎动作叠成了几段能读下去的话。";
    },
    paragraphLeads: [
      (partOfDay) => `从${partOfDay}开始，`,
      (partOfDay) => `后来到了${partOfDay}，`,
      (partOfDay) => `再往后一点，在${partOfDay}的时候，`,
      (partOfDay) => `临近这一程的后半段，${partOfDay}那会儿，`
    ],
    connectors: ["随后，", "接着，", "再后来，"],
    closings: {
      empty: "今天没有什么可夸耀的情节，但我想，安静本身也值得写给你。等下次屏幕重新热闹起来，我再把新的片段寄来。",
      brief: "说到底，今天也不过是一些轻微的敲击、几次窗口切换，和一点点没有明说的心事。可正因为寻常，我才更想把它写给你。",
      full: "总之，今天并没有发生什么传奇，只是我在一格格发亮的窗口之间走来走去，把情绪、注意力和没说出口的话都安放了一遍。要是你刚好也在某块屏幕前，希望这封信能在你那边停一会儿。"
    }
  },
  cinematic: {
    label: "电影感",
    intro(session, startedAt) {
      return `${session.recipient}，如果今天能被剪成一小段短片，我想它会从${startedAt}之后开始。屏幕亮起，窗口挪动，键盘发出细碎声响，而我把这些不起眼的镜头都留给了你。`;
    },
    empty(recipient) {
      return `${recipient}，今天的镜头很少，少到像一场没有对白的片头。可我还是想把这点安静寄出去，让它落在你手里。`;
    },
    range(firstPart, lastPart) {
      return `从${firstPart}到${lastPart}，这一整天没有什么惊天动地的情节，只有屏幕的明暗、窗口的进退，和我在其中来回走动的影子。`;
    },
    single() {
      return "今天真正留下来的，不过是一瞬间的亮光，但我舍不得让它白白过去。";
    },
    omitted(count) {
      return `中间还有 ${count} 个太零碎的镜头，我没有逐帧展开，只把它们压进了气氛里。`;
    },
    compression() {
      return "我把那些零碎动作剪掉了棱角，尽量让它们连成一段有呼吸的叙述。";
    },
    paragraphLeads: [
      (partOfDay) => `${partOfDay}像是缓慢拉开的第一幕，`,
      (partOfDay) => `镜头转到${partOfDay}时，`,
      (partOfDay) => `再往后，${partOfDay}的光线落下来，`,
      (partOfDay) => `快到尾声的时候，${partOfDay}那一段，`
    ],
    connectors: ["紧接着，", "然后，", "再之后，"],
    closings: {
      empty: "也许有些日子，本来就不该被解释得太满。它们只要静静存在，就已经足够像一封信。",
      brief: "如果把今天缩成一句话，大概就是：我在几块发亮的屏幕之间路过，顺手把没有说出的那部分，留成了字幕。",
      full: "所以今天真正值得记住的，不是我点开了什么、切走了什么，而是这些寻常动作最后竟也拼出了一点情绪的轮廓。若你读到这里，就当和我一起把片尾看完了。"
    }
  },
  minimal: {
    label: "克制",
    intro(session, startedAt) {
      return `你好，${session.recipient}。我从${startedAt}之后的这些桌面片段里，挑了几句最值得留下的话写给你。`;
    },
    empty(recipient) {
      return `你好，${recipient}。今天没有留下太多可说的动静，但我还是想把这份安静寄给你。`;
    },
    range(firstPart, lastPart) {
      return `从${firstPart}到${lastPart}，我大多时候都在窗口和键盘之间切换，情绪也夹在其中。`;
    },
    single() {
      return "今天的片段不多，但我想保留它。";
    },
    omitted(count) {
      return `还有 ${count} 个太琐碎的动作，我没有全部写下，只保留了轮廓。`;
    },
    compression() {
      return "我删掉了重复和噪音，只留下比较像句子的部分。";
    },
    paragraphLeads: [
      (partOfDay) => `${partOfDay}时，`,
      (partOfDay) => `到了${partOfDay}，`,
      (partOfDay) => `${partOfDay}再往后，`,
      (partOfDay) => `最后在${partOfDay}，`
    ],
    connectors: ["后来，", "接着，", "再然后，"],
    closings: {
      empty: "有时没有故事，本身也是一种可被保留的结果。",
      brief: "今天不复杂，只是一些键盘动作、几次窗口切换，以及没有说出口的思路。",
      full: "写到这里，我发现今天并没有什么特别大的情节，只有被整理过后还算诚实的一点日常。"
    }
  }
};

export function getSupportedVoices() {
  return Object.keys(voiceProfiles);
}

export function isSupportedVoice(voice) {
  return getSupportedVoices().includes(voice);
}

function resolveVoiceProfile(voice) {
  return voiceProfiles[voice] ?? voiceProfiles.gentle;
}

function sanitizeFilename(value, fallback) {
  const cleaned = value
    .replace(/[<>:"/\\|?*\r\n]+/gu, "")
    .replace(/\s+/gu, "_")
    .trim();

  return cleaned.slice(0, 24) || fallback;
}

function ensureSentence(message) {
  const trimmed = String(message ?? "").replace(/\s+/gu, " ").trim();
  if (!trimmed) {
    return "";
  }

  if (/[。！？]$/u.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}。`;
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateStamp(value) {
  const safeDate = parseDate(value) ?? new Date();
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  const day = String(safeDate.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function formatFullDate(value) {
  const safeDate = parseDate(value) ?? new Date();
  return safeDate.toLocaleString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function describePartOfDay(value) {
  const safeDate = parseDate(value);
  if (!safeDate) {
    return "今天";
  }

  const hour = safeDate.getHours();
  if (hour < 6) {
    return "凌晨";
  }
  if (hour < 9) {
    return "清晨";
  }
  if (hour < 12) {
    return "上午";
  }
  if (hour < 14) {
    return "中午";
  }
  if (hour < 18) {
    return "下午";
  }
  if (hour < 21) {
    return "傍晚";
  }

  return "夜里";
}

function rewriteEventForLetter(message) {
  const sentence = ensureSentence(message);
  if (!sentence) {
    return "";
  }

  return sentence.replace(/^你/u, "我");
}

function normalizeEvents(events) {
  return events
    .map((event) => ({
      timestamp: event?.timestamp ?? null,
      date: parseDate(event?.timestamp),
      message: rewriteEventForLetter(event?.message)
    }))
    .filter((event) => event.message);
}

function pickRepresentativeEvents(events, limit = maxLetterEvents) {
  if (events.length <= limit) {
    return events;
  }

  const pickedIndexes = new Set([0, events.length - 1]);
  const innerSlots = limit - 2;
  const stride = (events.length - 2) / innerSlots;

  for (let index = 0; index < innerSlots; index += 1) {
    const sourceIndex = 1 + Math.floor(index * stride + stride / 2);
    pickedIndexes.add(Math.min(events.length - 2, Math.max(1, sourceIndex)));
  }

  return [...pickedIndexes]
    .sort((left, right) => left - right)
    .map((index) => events[index]);
}

function chunkEvents(events) {
  const chunks = [];
  let currentChunk = [];

  for (const event of events) {
    const previous = currentChunk.at(-1);
    const gap = previous?.date && event.date ? event.date.getTime() - previous.date.getTime() : 0;

    if (
      currentChunk.length >= maxParagraphEvents ||
      (currentChunk.length >= 2 && gap > idleGapMs)
    ) {
      chunks.push(currentChunk);
      currentChunk = [];
    }

    currentChunk.push(event);
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function buildParagraph(chunk, index, profile) {
  const partOfDay = describePartOfDay(chunk[0]?.timestamp);
  const leadBuilder = profile.paragraphLeads[index] ?? profile.paragraphLeads.at(-1);
  const lead = leadBuilder(partOfDay);
  const sentences = chunk
    .map((event, eventIndex) => {
      if (eventIndex === 0) {
        return event.message;
      }

      return `${profile.connectors[(eventIndex - 1) % profile.connectors.length]}${event.message}`;
    })
    .join("");

  return `${lead}${sentences}`;
}

function buildIntro(session, totalEvents, selectedEvents, omittedEvents, profile) {
  const recipient = session.recipient || "你";
  const startedAt = formatFullDate(session.startedAt);
  const firstEvent = selectedEvents[0];
  const lastEvent = selectedEvents.at(-1);

  if (!firstEvent || !lastEvent) {
    return profile.empty(recipient);
  }

  const opening = profile.intro(session, startedAt);
  const ending = totalEvents > 1
    ? profile.range(describePartOfDay(firstEvent.timestamp), describePartOfDay(lastEvent.timestamp))
    : profile.single();
  const omitted = omittedEvents > 0
    ? profile.omitted(omittedEvents)
    : totalEvents > maxParagraphEvents
      ? profile.compression()
      : "";

  return [opening, ending, omitted].filter(Boolean).join("");
}

function buildClosing(totalEvents, profile) {
  if (totalEvents === 0) {
    return profile.closings.empty;
  }

  if (totalEvents < 4) {
    return profile.closings.brief;
  }

  return profile.closings.full;
}

function summarizeEvents(events) {
  if (events.length === 0) {
    return "静默片段";
  }

  const lastMessage = rewriteEventForLetter(events.at(-1).message)
    .replace(/[，。、《》“”‘’：:!！?？\[\]()（）]/gu, "")
    .replace(/^我/gu, "")
    .trim();

  return sanitizeFilename(lastMessage.slice(0, 10), "心事片段");
}

function buildLetterFilename(session, events, prefix = "致") {
  return `${prefix}_${sanitizeFilename(session.recipient ?? "未署名的人", "未署名的人")}_${formatDateStamp(session.startedAt)}_${summarizeEvents(events)}.txt`;
}

export function buildLetterText(session, events) {
  const profile = resolveVoiceProfile(session.voice);
  const normalizedEvents = normalizeEvents(events);
  const selectedEvents = pickRepresentativeEvents(normalizedEvents);
  const omittedEvents = Math.max(normalizedEvents.length - selectedEvents.length, 0);
  const paragraphs = chunkEvents(selectedEvents).map((chunk, index) => buildParagraph(chunk, index, profile));
  const lines = [`致亲爱的${session.recipient}：`, ""];

  lines.push(buildIntro(session, normalizedEvents.length, selectedEvents, omittedEvents, profile));

  if (paragraphs.length > 0) {
    lines.push("");
    lines.push(...paragraphs);
  } else {
    lines.push("");
    lines.push("今天的电脑没有留下太多响动，像是把整封信都让给了沉默。");
  }

  lines.push("");
  lines.push(buildClosing(normalizedEvents.length, profile));
  lines.push("");
  lines.push("此致");
  lines.push("敬礼");
  lines.push("");
  lines.push(`写于 ${formatFullDate(new Date())}`);

  return `${lines.join("\n")}\n`;
}

export async function writeLetter(session, events, options = {}) {
  const outputDir = options.outputDir ?? desktopDir();
  const prefix = options.prefix ?? "致";
  const outputPath = options.outputPath ?? path.join(outputDir, buildLetterFilename(session, events, prefix));
  const letterText = buildLetterText(session, events);

  await fsp.writeFile(outputPath, letterText, "utf8");

  return {
    letterText,
    outputPath
  };
}

export async function finalizeLetter() {
  const session = readJsonSync(sessionFile);
  if (!session) {
    return null;
  }

  const events = loadEventsSync();
  const {outputPath, letterText} = await writeLetter(session, events);
  await writeJson(resultFile, {
    outputPath,
    generatedAt: new Date().toISOString(),
    recipient: session.recipient,
    voice: session.voice ?? "gentle",
    preview: letterText
  });
  await cleanupRuntimeFiles();
  return outputPath;
}

export function readResultSync() {
  return fs.existsSync(resultFile) ? readJsonSync(resultFile) : null;
}
