import {runListener} from "./listener.js";

const recipient = process.argv[2] || "未署名的人";

await runListener(recipient);

// Keep the process alive for timers and keyboard hooks.
setInterval(() => {}, 1 << 30);
