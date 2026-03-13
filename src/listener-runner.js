import {runListener} from "./listener.js";

function parseSessionPayload(rawValue) {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

const sessionOptions = parseSessionPayload(process.argv[2]) ?? {
  recipient: "未署名的人",
  recipientKind: "someone",
  voice: "gentle",
  length: "standard",
  htmlExport: false
};

await runListener(sessionOptions);

// Keep the process alive for timers and keyboard hooks.
setInterval(() => {}, 1 << 30);
