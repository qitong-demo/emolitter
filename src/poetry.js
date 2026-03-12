const specialKeyMap = new Map([
  ["SPACE", "你留下一枚空格，让呼吸在句子中间轻轻停靠。"],
  ["RETURN", "你按下了回车，像替一句犹豫的话轻轻落款。"],
  ["ENTER", "你按下了回车，像替一句犹豫的话轻轻落款。"],
  ["TAB", "你拨动了 Tab，像给思路偷偷换了一条小路。"],
  ["BACKSPACE", "你按下退格，让一句话在反悔里重新长大。"],
  ["DELETE", "你触碰了 Delete，像把小小的懊恼扫进风里。"],
  ["ESCAPE", "你敲了敲 Esc，像给心情留了一条后路。"],
  ["ESC", "你敲了敲 Esc，像给心情留了一条后路。"],
  ["UP", "你碰了上方向键，像把念头往更高处提了提。"],
  ["DOWN", "你碰了下方向键，像让犹豫悄悄沉了一格。"],
  ["LEFT", "你拨了拨左方向键，像回头看了看刚才的心事。"],
  ["RIGHT", "你拨了拨右方向键，像催自己往明天挪了一小步。"],
  ["LEFT SHIFT", "你按住 Shift，像突然把语气抬高半寸。"],
  ["RIGHT SHIFT", "你按住 Shift，像突然把语气抬高半寸。"],
  ["LEFT CTRL", "你碰了碰 Ctrl，像打算和世界谈个条件。"],
  ["RIGHT CTRL", "你碰了碰 Ctrl，像打算和世界谈个条件。"],
  ["LEFT ALT", "你碰了碰 Alt，像替普通时刻偷偷加了一层副标题。"],
  ["RIGHT ALT", "你碰了碰 Alt，像替普通时刻偷偷加了一层副标题。"],
  ["LEFT META", "你按住了系统键，像想把现实也调成快捷操作。"],
  ["RIGHT META", "你按住了系统键，像想把现实也调成快捷操作。"]
]);

export function describeKeyEvent(event) {
  const keyName = String(event.name ?? "").trim();
  if (!keyName) {
    return null;
  }

  const upperName = keyName.toUpperCase();
  if (upperName.startsWith("MOUSE")) {
    return null;
  }

  if (specialKeyMap.has(upperName)) {
    return specialKeyMap.get(upperName);
  }

  if (upperName.length === 1) {
    return `你轻轻敲下「${keyName.toLowerCase()}」，仿佛在替沉默添一笔旁白。`;
  }

  return `你按下了「${keyName}」，像把一小段情绪交给了键盘保管。`;
}

export function describeWindow(title, appName) {
  if (title && appName && !title.includes(appName)) {
    return `你踏入了「${appName}｜${title}」的领地，像给情绪换了一盏台灯。`;
  }

  return `你踏入了「${title || appName || "未知窗口"}」的领地，像给情绪换了一盏台灯。`;
}
