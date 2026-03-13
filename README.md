# emolitter

![emolitter hero](./assets/github-hero.svg)

`emolitter` 是一个 local-first 的创意命令行工具。

它会把你在电脑前的一段日常动作, 整理成一封真正能读下去的信:
不是效率报表, 不是时间追踪图, 而是一份带情绪、带停顿、带叙述感的桌面来信。

这个项目更适合被理解为:

- 一个创意工具
- 一个开源小作品
- 一个关于数字日常、情绪记录和个人表达的实验

## 一句话理解它

把你一天的桌面日常, 写成一封真正能读下去的信。

不是 time tracker, 更像一封来自数字生活的来信。

## 先看样张

### gentle / 创作者的一天

> 从上午开始，我铺开了一张看不见的信纸，决定把今天写给未来的我。
>
> 随后，我踏入了「Visual Studio Code｜README.md」的领地，像给情绪换了一盏台灯。
>
> 接着，我轻轻敲下「r」，仿佛在替沉默添一笔旁白。

完整样张见 [examples/gentle-maker.txt](./examples/gentle-maker.txt)

### cinematic / 深夜项目

> 夜里像是缓慢拉开的第一幕，我铺开了一张看不见的信纸，决定把今天写给小王。
>
> 紧接着，我踏入了「Terminal｜npm run build」的领地，像给情绪换了一盏台灯。
>
> 所以今天真正值得记住的，不是我点开了什么、切走了什么，而是这些寻常动作最后竟也拼出了一点情绪的轮廓。

完整样张见 [examples/cinematic-midnight.txt](./examples/cinematic-midnight.txt)

### minimal / 普通工作日

> 你好，你。我从 2026 年 3 月 13 日 10:00 之后的这些桌面片段里，挑了几句最值得留下的话写给你。
>
> 我删掉了重复和噪音，只留下比较像句子的部分。

完整样张见 [examples/minimal-office.txt](./examples/minimal-office.txt)

## 它适合谁

- 想把普通电脑日常写成有情绪的文字的人
- 想做一件有记忆点的开源作品的人
- 想给自己、给朋友、给未来留下一封数字书信的人
- 想做 demo、录视频、发 GitHub / 小红书 / B 站内容的人

## 它不是什么

- 它不是时间管理 SaaS
- 它不是严格意义上的效率追踪器
- 它不是屏幕历史搜索工具

`emolitter` 的价值不在统计, 而在表达。

## 现在的能力

- `emo open` 启动后台监听
- `emo close` 结束记录, 生成书信
- `emo status` 查看当前记录状态
- `emo sample` 直接生成一封演示样张, 不需要先开权限
- `emo showcase` 一键导出展示素材包
- 支持不同书信风格: `gentle` / `cinematic` / `minimal`
- 输出会尽量整理成段落, 而不是日志式逐条回放
- 结果默认保存到桌面, 便于截图、分享和二次编辑

## 安装

本地开发:

```bash
npm install
npm install -g .
```

如果已经发布到 npm:

```bash
npm install -g emolitter
```

## 快速开始

开始记录:

```bash
emo open --to "未来的我" --voice gentle
```

结束并生成书信:

```bash
emo close
```

在终端直接查看成品:

```bash
emo close --stdout
```

查看当前状态:

```bash
emo status
```

不用开监听, 直接生成演示样张:

```bash
emo sample --to "小王" --voice cinematic --theme midnight --stdout
```

一键导出展示素材包:

```bash
emo showcase --to "小王" --theme midnight
```

## 演示素材

如果你想把它当成开源作品、个人品牌项目或短视频素材来展示, 可以直接复用：

- 演示截图脚本和首页标题建议: [docs/SHOWCASE.md](./docs/SHOWCASE.md)
- 社交文案与发布用语: [docs/LAUNCH_POSTS.md](./docs/LAUNCH_POSTS.md)
- 视觉系统与封面素材: [docs/VISUALS.md](./docs/VISUALS.md)
- 首屏 GIF 脚本: [docs/GIF_SCRIPT.md](./docs/GIF_SCRIPT.md)
- 创作者主题样张: [examples/gentle-maker.txt](./examples/gentle-maker.txt)
- 深夜项目主题样张: [examples/cinematic-midnight.txt](./examples/cinematic-midnight.txt)
- 克制风格样张: [examples/minimal-office.txt](./examples/minimal-office.txt)

## 命令说明

### `emo open`

启动后台监听。

```bash
emo open [--to 收信人] [--voice gentle|cinematic|minimal]
```

示例:

```bash
emo open --to "未来的我" --voice cinematic
```

### `emo close`

停止监听并生成书信。

```bash
emo close [--stdout]
```

### `emo status`

查看当前是否正在记录、收信人是谁、用了什么风格、已经收集了多少事件。

```bash
emo status
```

### `emo sample`

直接生成一封演示样张, 适合做截图、录屏、展示 README 或社交媒体内容。

```bash
emo sample [--to 收信人] [--voice gentle|cinematic|minimal] [--theme maker|office|midnight] [--stdout]
```

示例:

```bash
emo sample --to "朋友" --voice minimal --theme office
```

### `emo showcase`

一次性导出适合 GitHub 首页、截图和发帖的展示包。

```bash
emo showcase [--to 收信人] [--theme maker|office|midnight] [--dir 输出目录]
```

导出的 bundle 默认包含:

- 3 封不同 voice 的样张信
- 1 份首页可引用摘录
- 1 份封面标题候选
- 1 份社交发布文案
- 1 份展示总览说明

## 书信风格

### `gentle`

默认风格。更柔和, 更像写给某个人的日常来信。

### `cinematic`

更适合做展示和传播。语气更有镜头感, 适合深夜项目、创作者主题、短视频文案。

### `minimal`

更克制, 更像简短但有质感的日记。

## 样张主题

### `maker`

创作者 / 开发者的一天。

### `office`

普通工作日的桌面片段。

### `midnight`

深夜项目、赶工、独处感更强的场景。

## 输出结果

- 文件默认保存在桌面
- 文件名格式大致为: `致_收信人_日期_总结.txt`
- 样张文件会用 `样张_...txt` 前缀
- 终端预览可以用 `--stdout`

## 平台与权限

- Windows、macOS、Linux 都可以运行
- macOS 通常需要辅助功能权限
- Linux 下窗口监听依赖桌面环境, Wayland 支持有限
- 全局键盘监听可能会被系统安全策略、杀毒软件或权限设置拦截

如果你只是想先看效果, 建议先用:

```bash
emo sample --stdout
```

## 隐私说明

这是一个 local-first 工具:

- 监听与生成都在本机完成
- 结果默认写到你的桌面
- 运行时状态写在 `~/.emolitter`
- 当前版本不会主动上传内容到云端

即便如此, 你仍然应该只在自己信任的环境里使用它。

## 开发

查看帮助:

```bash
npm run check
```

快速生成一个样张:

```bash
npm run sample
```

快速导出展示包:

```bash
npm run showcase
```

本地打包:

```bash
npm pack
```

## 为什么做它

我不太想再做一个“告诉你今天有多高效”的工具。

我更想做一个能把普通数字生活重新写得像作品的东西:
让窗口切换、键盘敲击、犹豫、停顿和深夜里的小动作, 都有机会被整理成一封信。

如果它刚好让你觉得:

- “今天也许并不值得统计, 但值得写下来”
- “原来普通的电脑日常也能有一点文学感”
- “这不像产品需求, 更像一个人做给世界看的作品”

那它就已经有价值了。

## License

MIT
