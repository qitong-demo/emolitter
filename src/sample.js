const sampleThemes = {
  maker: {
    label: "创作者的一天",
    startHour: 9,
    offsets: [0, 6, 15, 80, 128, 185, 262],
    events: [
      "你铺开了一张看不见的信纸，决定把今天写给收信人。",
      "你踏入了「Visual Studio Code｜README.md」的领地，像给情绪换了一盏台灯。",
      "你轻轻敲下「r」，仿佛在替沉默添一笔旁白。",
      "你按下了回车，像替一句犹豫的话轻轻落款。",
      "你踏入了「Chrome｜灵感检索」的领地，像给情绪换了一盏台灯。",
      "你留下一枚空格，让呼吸在句子中间轻轻停靠。",
      "你敲了敲 Esc，像给心情留了一条后路。"
    ]
  },
  office: {
    label: "普通工作日",
    startHour: 10,
    offsets: [0, 12, 28, 95, 144, 233, 316],
    events: [
      "你铺开了一张看不见的信纸，决定把今天写给收信人。",
      "你踏入了「Outlook｜未读邮件」的领地，像给情绪换了一盏台灯。",
      "你按下了「Ctrl」，像打算和世界谈个条件。",
      "你踏入了「Excel｜周报」的领地，像给情绪换了一盏台灯。",
      "你按下退格，让一句话在反悔里重新长大。",
      "你踏入了「Chrome｜项目文档」的领地，像给情绪换了一盏台灯。",
      "你按下了回车，像替一句犹豫的话轻轻落款。"
    ]
  },
  midnight: {
    label: "深夜项目",
    startHour: 22,
    offsets: [0, 9, 24, 66, 128, 171, 240],
    events: [
      "你铺开了一张看不见的信纸，决定把今天写给收信人。",
      "你踏入了「Terminal｜npm run build」的领地，像给情绪换了一盏台灯。",
      "你轻轻敲下「a」，仿佛在替沉默添一笔旁白。",
      "你踏入了「Visual Studio Code｜src/letter.js」的领地，像给情绪换了一盏台灯。",
      "你按下了 Tab，像给思路偷偷换了一条小路。",
      "你踏入了「Chrome｜一篇还没读完的文章」的领地，像给情绪换了一盏台灯。",
      "你敲了敲 Esc，像给心情留了一条后路。"
    ]
  }
};

export function getSampleThemes() {
  return Object.keys(sampleThemes);
}

export function isSupportedSampleTheme(theme) {
  return getSampleThemes().includes(theme);
}

export function getSampleThemeLabel(theme) {
  return sampleThemes[theme]?.label ?? sampleThemes.maker.label;
}

export function createSampleSession({recipient = "未来的我", voice = "gentle", theme = "maker"} = {}) {
  const selectedTheme = sampleThemes[theme] ?? sampleThemes.maker;
  const startedAt = new Date();
  startedAt.setHours(selectedTheme.startHour, 0, 0, 0);

  return {
    recipient,
    voice,
    startedAt: startedAt.toISOString()
  };
}

export function createSampleEvents({recipient = "未来的我", theme = "maker"} = {}) {
  const selectedTheme = sampleThemes[theme] ?? sampleThemes.maker;
  const startedAt = new Date();
  startedAt.setHours(selectedTheme.startHour, 0, 0, 0);

  return selectedTheme.events.map((message, index) => {
    const eventTime = new Date(startedAt.getTime() + selectedTheme.offsets[index] * 60 * 1000);
    return {
      timestamp: eventTime.toISOString(),
      message: message.replaceAll("收信人", recipient)
    };
  });
}
