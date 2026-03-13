import {runListener} from "./listener.js";

const recipient = process.argv[2] || "未署名的人";
const voice = process.argv[3] || "gentle";

await runListener({recipient, voice});

// Keep the process alive for timers and keyboard hooks.
setInterval(() => {}, 1 << 30);
