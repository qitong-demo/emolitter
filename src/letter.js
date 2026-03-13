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
import {appendHistoryEntry} from "./history.js";

const idleGapMs = 12 * 60 * 1000;

const lengthProfiles = {
  short: {
    label: "短笺",
    eventLimit: 6,
    paragraphEvents: 2,
    closingStyle: "brief"
  },
  standard: {
    label: "标准",
    eventLimit: 10,
    paragraphEvents: 3,
    closingStyle: "full"
  },
  long: {
    label: "长信",
    eventLimit: 16,
    paragraphEvents: 4,
    closingStyle: "long"
  }
};

const recipientProfiles = {
  someone: {
    label: "写给某个人",
    fallbackRecipient: "未署名的人",
    salutation(recipient) {
      return `致亲爱的${recipient}：`;
    },
    introReason() {
      return "把今天认真写给你";
    }
  },
  self: {
    label: "写给自己",
    fallbackRecipient: "今天的自己",
    salutation(recipient) {
      return `致${recipient}：`;
    },
    introReason() {
      return "给今天的自己留下一封回信";
    }
  },
  future: {
    label: "写给未来",
    fallbackRecipient: "未来的我",
    salutation(recipient) {
      return `致${recipient}：`;
    },
    introReason() {
      return "把今天折好，寄给未来";
    }
  }
};

const voiceProfiles = {
  gentle: {
    label: "温柔",
    intro(session, startedAt, reason) {
      return `见字如面，${session.recipient}。这封信写于${startedAt}之后，起初只是想${reason}。后来我发现，那些散落在屏幕前的细碎动静，也值得被慢慢整理成几句能读下去的话。`;
    },
    empty(recipient) {
      return `见字如面，${recipient}。今天我本来想从电脑边上给你捎几句近况，可屏幕安静得很，最后只剩下一点没有发出声响的心思。`;
    },
    range(firstPart, lastPart) {
      return `从${firstPart}到${lastPart}，我在窗口和键盘之间来回了一阵，也顺手把心绪留了下来。`;
    },
    single() {
      return "今天的动静不多，可我还是想把这一个小小片刻写下来。";
    },
    omitted(count) {
      return `中间其实还有 ${count} 个过于细小的动作，我没有逐条写进来，只把它们折成停顿，夹在下面这些句子里。`;
    },
    compression(lengthLabel) {
      return `我把这封${lengthLabel}尽量写得像信，而不是流水账。`;
    },
    paragraphLeads: [
      (partOfDay) => `从${partOfDay}开始，`,
      (partOfDay) => `后来到了${partOfDay}，`,
      (partOfDay) => `再往后一点，在${partOfDay}的时候，`,
      (partOfDay) => `临近这一程的后半段，${partOfDay}那会儿，`
    ],
    connectors: ["随后，", "接着，", "再后来，"],
    closings: {
      brief: "今天也不过是一些轻微的敲击、几次窗口切换，和一点点没有明说的心事。可正因为寻常，我才更想把它写下来。",
      full: "总之，今天并没有发生什么传奇，只是我在一格格发亮的窗口之间走来走去，把情绪、注意力和没说出口的话都安放了一遍。希望将来再读到它时，我还能认出今天的自己。",
      long: "写到这里，我忽然觉得，很多并不值得统计的瞬间，反而更值得被保留。它们既不宏大，也不激烈，只是在某个窗口切换、某次停顿、某个字母落下的时候，悄悄让今天长出了形状。"
    }
  },
  cinematic: {
    label: "电影感",
    intro(session, startedAt, reason) {
      return `${session.recipient}，如果今天能被剪成一小段短片，我想它会从${startedAt}之后开始。屏幕亮起，窗口挪动，键盘发出细碎声响，而我想${reason}。`;
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
    compression(lengthLabel) {
      return `我把这封${lengthLabel}里的零碎动作剪掉了棱角，尽量让它们连成一段有呼吸的叙述。`;
    },
    paragraphLeads: [
      (partOfDay) => `${partOfDay}像是缓慢拉开的第一幕，`,
      (partOfDay) => `镜头转到${partOfDay}时，`,
      (partOfDay) => `再往后，${partOfDay}的光线落下来，`,
      (partOfDay) => `快到尾声的时候，${partOfDay}那一段，`
    ],
    connectors: ["紧接着，", "然后，", "再之后，"],
    closings: {
      brief: "如果把今天缩成一句话，大概就是：我在几块发亮的屏幕之间路过，顺手把没有说出的那部分，留成了字幕。",
      full: "所以今天真正值得记住的，不是我点开了什么、切走了什么，而是这些寻常动作最后竟也拼出了一点情绪的轮廓。若你读到这里，就当和我一起把片尾看完了。",
      long: "有些日子其实没有故事线，只有光线、停顿和不肯消失的细节。可正是这些不够热闹的镜头，最后把今天剪成了一部只属于我的小片子。"
    }
  },
  minimal: {
    label: "克制",
    intro(session, startedAt, reason) {
      return `你好，${session.recipient}。我从${startedAt}之后的这些桌面片段里，挑了几句最值得留下的话，想${reason}。`;
    },
    empty(recipient) {
      return `你好，${recipient}。今天没有留下太多可说的动静，但我还是想把这份安静寄出去。`;
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
    compression(lengthLabel) {
      return `我删掉了重复和噪音，只留下比较像句子的部分，把这封${lengthLabel}写得更克制一点。`;
    },
    paragraphLeads: [
      (partOfDay) => `${partOfDay}时，`,
      (partOfDay) => `到了${partOfDay}，`,
      (partOfDay) => `${partOfDay}再往后，`,
      (partOfDay) => `最后在${partOfDay}，`
    ],
    connectors: ["后来，", "接着，", "再然后，"],
    closings: {
      brief: "今天不复杂，只是一些键盘动作、几次窗口切换，以及没有说出口的思路。",
      full: "写到这里，我发现今天并没有什么特别大的情节，只有被整理过后还算诚实的一点日常。",
      long: "如果一定要给今天下一个结论，那大概只是：它并不戏剧化，却足够真实，而真实本身就值得留档。"
    }
  }
};

export function getSupportedVoices() {
  return Object.keys(voiceProfiles);
}

export function isSupportedVoice(voice) {
  return getSupportedVoices().includes(voice);
}

export function getSupportedLengths() {
  return Object.keys(lengthProfiles);
}

export function isSupportedLength(length) {
  return getSupportedLengths().includes(length);
}

export function getSupportedRecipientKinds() {
  return Object.keys(recipientProfiles);
}

export function isSupportedRecipientKind(recipientKind) {
  return getSupportedRecipientKinds().includes(recipientKind);
}

export function getVoiceLabel(voice) {
  return resolveVoiceProfile(voice).label;
}

export function getLengthLabel(length) {
  return resolveLengthProfile(length).label;
}

export function getRecipientKindLabel(recipientKind) {
  return resolveRecipientProfile(recipientKind).label;
}

function resolveVoiceProfile(voice) {
  return voiceProfiles[voice] ?? voiceProfiles.gentle;
}

function resolveLengthProfile(length) {
  return lengthProfiles[length] ?? lengthProfiles.standard;
}

function resolveRecipientProfile(recipientKind) {
  return recipientProfiles[recipientKind] ?? recipientProfiles.someone;
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

function pickRepresentativeEvents(events, limit) {
  if (events.length <= limit) {
    return events;
  }

  const pickedIndexes = new Set([0, events.length - 1]);
  const innerSlots = Math.max(limit - 2, 1);
  const stride = (events.length - 2) / innerSlots;

  for (let index = 0; index < innerSlots; index += 1) {
    const sourceIndex = 1 + Math.floor(index * stride + stride / 2);
    pickedIndexes.add(Math.min(events.length - 2, Math.max(1, sourceIndex)));
  }

  return [...pickedIndexes]
    .sort((left, right) => left - right)
    .map((index) => events[index]);
}

function chunkEvents(events, paragraphEvents) {
  const chunks = [];
  let currentChunk = [];

  for (const event of events) {
    const previous = currentChunk.at(-1);
    const gap = previous?.date && event.date ? event.date.getTime() - previous.date.getTime() : 0;

    if (
      currentChunk.length >= paragraphEvents ||
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

export function normalizeSession(session = {}) {
  const recipientProfile = resolveRecipientProfile(session.recipientKind);
  const recipient = (session.recipient ?? "").trim() || recipientProfile.fallbackRecipient;

  return {
    recipient,
    recipientKind: session.recipientKind ?? "someone",
    voice: session.voice ?? "gentle",
    length: session.length ?? "standard",
    startedAt: session.startedAt ?? new Date().toISOString(),
    outputDir: session.outputDir ?? desktopDir(),
    htmlExport: Boolean(session.htmlExport)
  };
}

function buildParagraph(chunk, index, voiceProfile) {
  const partOfDay = describePartOfDay(chunk[0]?.timestamp);
  const leadBuilder = voiceProfile.paragraphLeads[index] ?? voiceProfile.paragraphLeads.at(-1);
  const lead = leadBuilder(partOfDay);
  const sentences = chunk
    .map((event, eventIndex) => {
      if (eventIndex === 0) {
        return event.message;
      }

      return `${voiceProfile.connectors[(eventIndex - 1) % voiceProfile.connectors.length]}${event.message}`;
    })
    .join("");

  return `${lead}${sentences}`;
}

function buildIntro(session, totalEvents, selectedEvents, omittedEvents, voiceProfile, lengthProfile, recipientProfile) {
  const firstEvent = selectedEvents[0];
  const lastEvent = selectedEvents.at(-1);
  const startedAt = formatFullDate(session.startedAt);

  if (!firstEvent || !lastEvent) {
    return voiceProfile.empty(session.recipient);
  }

  const opening = voiceProfile.intro(session, startedAt, recipientProfile.introReason());
  const timing = totalEvents > 1
    ? voiceProfile.range(describePartOfDay(firstEvent.timestamp), describePartOfDay(lastEvent.timestamp))
    : voiceProfile.single();
  const omitted = omittedEvents > 0
    ? voiceProfile.omitted(omittedEvents)
    : totalEvents > lengthProfile.paragraphEvents
      ? voiceProfile.compression(lengthProfile.label)
      : "";

  return [opening, timing, omitted].filter(Boolean).join("");
}

function buildClosing(totalEvents, voiceProfile, lengthProfile) {
  if (totalEvents === 0) {
    return voiceProfile.closings.brief;
  }

  return voiceProfile.closings[lengthProfile.closingStyle] ?? voiceProfile.closings.full;
}

function buildLetterFilename(session, events, prefix = "致") {
  return `${prefix}_${sanitizeFilename(session.recipient, "未署名的人")}_${formatDateStamp(session.startedAt)}_${summarizeEvents(events)}.txt`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function renderLetterHtml(session, letterText) {
  const safeSession = normalizeSession(session);
  const paragraphs = letterText
    .trim()
    .split(/\r?\n\r?\n/u)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) =>
      `<p>${escapeHtml(chunk).replace(/\r?\n/gu, "<br>")}</p>`
    )
    .join("\n        ");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>emolitter - ${escapeHtml(safeSession.recipient)}</title>
    <style>
      :root {
        color-scheme: light;
        --paper: #fff9ef;
        --paper-edge: #f0dec4;
        --ink: #34231d;
        --muted: #73584a;
        --accent: #b86a47;
        --bg: radial-gradient(circle at top right, #f3d9b8 0, #d39a6f 24%, #724132 57%, #251d1a 100%);
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Noto Serif SC", "Songti SC", "Source Han Serif SC", serif;
        background: var(--bg);
        color: var(--ink);
        display: grid;
        place-items: center;
        padding: 40px 20px;
      }

      .page {
        width: min(860px, 100%);
        background: linear-gradient(180deg, var(--paper), var(--paper-edge));
        border-radius: 28px;
        padding: 48px;
        box-shadow: 0 28px 80px rgba(19, 12, 9, 0.28);
        position: relative;
      }

      .eyebrow {
        font-family: "IBM Plex Mono", "Consolas", monospace;
        color: var(--accent);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-size: 14px;
      }

      h1 {
        margin: 12px 0 8px;
        font-size: clamp(32px, 4vw, 52px);
        line-height: 1.08;
      }

      .meta {
        margin: 0 0 28px;
        color: var(--muted);
        font-size: 16px;
      }

      article {
        display: grid;
        gap: 18px;
        font-size: 20px;
        line-height: 1.95;
      }

      p {
        margin: 0;
        white-space: normal;
      }

      .footer {
        margin-top: 28px;
        color: var(--muted);
        font-size: 14px;
        display: flex;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
    </style>
  </head>
  <body>
    <main class="page">
      <div class="eyebrow">emolitter / local-first letter</div>
      <h1>${escapeHtml(safeSession.recipient)}</h1>
      <p class="meta">${escapeHtml(`${getRecipientKindLabel(safeSession.recipientKind)} · ${getVoiceLabel(safeSession.voice)} · ${getLengthLabel(safeSession.length)}`)}</p>
      <article>
        ${paragraphs}
      </article>
      <div class="footer">
        <span>写于 ${escapeHtml(formatFullDate(new Date()))}</span>
        <span>Generated by emolitter</span>
      </div>
    </main>
  </body>
</html>
`;
}

export function buildLetterText(session, events) {
  const safeSession = normalizeSession(session);
  const voiceProfile = resolveVoiceProfile(safeSession.voice);
  const lengthProfile = resolveLengthProfile(safeSession.length);
  const recipientProfile = resolveRecipientProfile(safeSession.recipientKind);
  const normalizedEvents = normalizeEvents(events);
  const selectedEvents = pickRepresentativeEvents(normalizedEvents, lengthProfile.eventLimit);
  const omittedEvents = Math.max(normalizedEvents.length - selectedEvents.length, 0);
  const paragraphs = chunkEvents(selectedEvents, lengthProfile.paragraphEvents).map((chunk, index) =>
    buildParagraph(chunk, index, voiceProfile)
  );
  const lines = [recipientProfile.salutation(safeSession.recipient), ""];

  lines.push(buildIntro(safeSession, normalizedEvents.length, selectedEvents, omittedEvents, voiceProfile, lengthProfile, recipientProfile));

  if (paragraphs.length > 0) {
    lines.push("");
    lines.push(...paragraphs);
  } else {
    lines.push("");
    lines.push("今天的电脑没有留下太多响动，像是把整封信都让给了沉默。");
  }

  lines.push("");
  lines.push(buildClosing(normalizedEvents.length, voiceProfile, lengthProfile));
  lines.push("");
  lines.push("此致");
  lines.push("敬礼");
  lines.push("");
  lines.push(`写于 ${formatFullDate(new Date())}`);

  return `${lines.join("\n")}\n`;
}

export async function writeLetter(session, events, options = {}) {
  const safeSession = normalizeSession(session);
  const outputDir = options.outputDir ?? safeSession.outputDir ?? desktopDir();
  const prefix = options.prefix ?? "致";
  const outputPath = options.outputPath ?? path.join(outputDir, buildLetterFilename(safeSession, events, prefix));
  const letterText = buildLetterText(safeSession, events);
  const shouldExportHtml = options.html ?? safeSession.htmlExport ?? false;

  await fsp.mkdir(path.dirname(outputPath), {recursive: true});
  await fsp.writeFile(outputPath, letterText, "utf8");

  let htmlPath = null;
  if (shouldExportHtml) {
    htmlPath = options.htmlPath ?? outputPath.replace(/\.txt$/iu, ".html");
    await fsp.writeFile(htmlPath, renderLetterHtml(safeSession, letterText), "utf8");
  }

  if (options.recordHistory) {
    await appendHistoryEntry({
      source: options.historyEntry?.source ?? "letter",
      generatedAt: new Date().toISOString(),
      recipient: safeSession.recipient,
      recipientKind: safeSession.recipientKind,
      voice: safeSession.voice,
        length: safeSession.length,
        outputPath,
        htmlPath,
        preview: letterText,
        ...options.historyEntry
      });
  }

  return {
    letterText,
    outputPath,
    htmlPath
  };
}

export async function finalizeLetter() {
  const session = readJsonSync(sessionFile);
  if (!session) {
    return null;
  }

  const safeSession = normalizeSession(session);
  const events = loadEventsSync();
  const {outputPath, htmlPath, letterText} = await writeLetter(safeSession, events, {
    recordHistory: true,
    html: safeSession.htmlExport,
    historyEntry: {
      source: "live"
    }
  });
  await writeJson(resultFile, {
    outputPath,
    htmlPath,
    generatedAt: new Date().toISOString(),
    recipient: safeSession.recipient,
    recipientKind: safeSession.recipientKind,
    voice: safeSession.voice,
    length: safeSession.length,
    preview: letterText
  });
  await cleanupRuntimeFiles();
  return outputPath;
}

export function readResultSync() {
  return fs.existsSync(resultFile) ? readJsonSync(resultFile) : null;
}
