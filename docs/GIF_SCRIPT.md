# GIF Script

这份脚本是给 README 首屏 GIF、短视频前 10 到 15 秒、以及 GitHub 项目演示用的。

## 目标

让第一次看到 `emoletter` 的人, 在 10 秒内理解:

- 这不是时间追踪器
- 它会生成一封真正能读的信
- 它看起来有作品感, 而不是技术演示感

## 时长建议

- GitHub README GIF: 8-12 秒
- 社媒短视频开场: 12-18 秒

## 镜头脚本

### 镜头 1 / 0-2 秒

- 画面: 终端空白, 光标闪动
- 操作: 输入 `emo showcase --to "小王" --kind someone --length standard --theme midnight`
- 画面文案: `A letter from your digital day`

### 镜头 2 / 2-4 秒

- 画面: 回车后显示 bundle 已生成
- 停留文本:

```text
已生成展示包：
- 3 封不同 voice 的样张信
- 1 份首页可引用摘录
- 1 份封面标题候选
```

- 画面文案: `not a dashboard`

### 镜头 3 / 4-7 秒

- 画面: 先快速打开 `index.html`, 再切到 `cinematic-midnight.html`
- 建议停在以下几句:

```text
小王，如果今天能被剪成一小段短片，
我想它会从 2026 年 3 月 13 日 22:00 之后开始。
屏幕亮起，窗口挪动，键盘发出细碎声响，
而我把这些不起眼的镜头都留给了你。
```

- 画面文案: `a readable letter`

### 镜头 4 / 7-10 秒

- 画面: 滚动到正文中段
- 建议停在:

```text
镜头转到夜里时，我轻轻敲下「a」，
仿佛在替沉默添一笔旁白。
紧接着，我踏入了「Visual Studio Code｜src/letter.js」的领地，
像给情绪换了一盏台灯。
```

- 画面文案: `ordinary desktop life, rewritten`

### 镜头 5 / 10-12 秒

- 画面: 最后一段 + `此致 敬礼`
- 画面文案: `emoletter / open source / local-first`

## 录制建议

1. 终端主题用暖色或米白背景, 不要纯黑高对比极客风
2. 字体尽量用有书卷感的中文衬线字体或清晰等宽字体
3. 每次切镜头前停 0.5 秒, 给读者反应时间
4. 画面里不要塞太多解释文字
5. 最多只保留 1 到 2 条字幕

## 备用脚本

如果你只想做最短的 6 秒 GIF:

1. 输入 `emo sample --voice cinematic --theme midnight --stdout`
2. 停在第一段
3. 跳到最后一段
4. 收尾打出 `Not a time tracker. A letter from your digital day.`
