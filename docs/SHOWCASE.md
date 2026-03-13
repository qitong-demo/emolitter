# Showcase Kit

这份文档是给 `emolitter` 的展示、截图、录屏和社交传播准备的。

目标不是介绍所有技术细节, 而是让别人一眼明白:

- 这是什么
- 它为什么特别
- 它生成出来的东西为什么值得看

## 首页标题候选

### 版本 A

把你一天的桌面日常, 写成一封真正能读下去的信。

### 版本 B

Not a time tracker. A letter from your digital day.

### 版本 C

我做了一个程序, 会把普通的电脑生活写成一封信。

## 首页副标题候选

### 版本 A

`emolitter` 是一个 local-first 的创意 CLI。它监听键盘与窗口切换, 但最后交付的不是报表, 而是一封带情绪、带停顿、带叙述感的桌面来信。

### 版本 B

为那些“不值得统计, 但值得写下来”的数字时刻而做。

### 版本 C

更像创意工具、开源作品和个人表达实验, 而不是效率产品。

## GitHub 首页推荐结构

1. 一句能让人停下来的标题
2. 一段一句话解释
3. 一小段样张摘录
4. 最短可运行命令
5. 一张效果图或录屏 GIF
6. 再往下才是安装、权限、平台兼容性

## 一键生成展示包

如果你不想手工准备素材, 可以直接运行:

```bash
emo showcase --to "小王" --kind someone --length standard --theme midnight
```

它会生成一个本地展示包, 默认包含:

- 3 封不同风格的样张信
- 3 个 HTML 展示页
- 1 个 `index.html` 总览页
- README 可引用摘录
- 封面标题候选
- 社交发帖文案
- 一份总览说明

## 首页样张摘录推荐

### 样张 1

> 从上午开始，我铺开了一张看不见的信纸，决定把今天写给未来的我。
>
> 随后，我踏入了「Visual Studio Code｜README.md」的领地，像给情绪换了一盏台灯。
>
> 接着，我轻轻敲下「r」，仿佛在替沉默添一笔旁白。

### 样张 2

> 夜里像是缓慢拉开的第一幕，我铺开了一张看不见的信纸，决定把今天写给小王。
>
> 紧接着，我踏入了「Terminal｜npm run build」的领地，像给情绪换了一盏台灯。
>
> 所以今天真正值得记住的，不是我点开了什么、切走了什么，而是这些寻常动作最后竟也拼出了一点情绪的轮廓。

## 演示截图脚本

### 截图 1: 开场

- 画面内容: 终端中输入 `emo sample --voice cinematic --theme midnight --stdout`
- 标题文案: `一个会替你的桌面写信的 CLI`
- 角标文案: `local-first / creative tool / open source`

### 截图 2: 命令输出

- 画面内容: 终端显示 `已生成样张`
- 标题文案: `不是报表, 是一封信`
- 角标文案: `Sample theme: midnight`

### 截图 3: 信件开头

- 画面内容: 打开生成的 txt, 停留在称呼和第一段
- 标题文案: `把普通电脑日常写成可读的文字`
- 推荐取景文本:

```text
小王，如果今天能被剪成一小段短片，
我想它会从 2026 年 3 月 13 日 22:00 之后开始。
屏幕亮起，窗口挪动，键盘发出细碎声响，
而我把这些不起眼的镜头都留给了你。
```

### 截图 4: 正文段落

- 画面内容: 停留在中间一段最有“镜头感”的内容
- 标题文案: `窗口切换, 也可以有情绪`
- 推荐取景文本:

```text
镜头转到夜里时，我轻轻敲下「a」，
仿佛在替沉默添一笔旁白。
紧接着，我踏入了「Visual Studio Code｜src/letter.js」的领地，
像给情绪换了一盏台灯。
```

### 截图 5: 收尾

- 画面内容: 结尾段 + `此致 敬礼`
- 标题文案: `像作品一样收尾`
- 角标文案: `emo close --stdout`

## 20 秒录屏脚本

### 0-3 秒

- 画面: 打开终端
- 屏幕文案: `I built a CLI that turns desktop activity into a letter.`

### 3-7 秒

- 画面: 输入 `emo sample --voice cinematic --theme midnight --stdout`
- 口播: `It doesn't generate analytics. It writes your digital day back to you.`

### 7-14 秒

- 画面: 快速滚过生成的信
- 屏幕文案: `not a time tracker`
- 屏幕文案: `a letter from your digital day`

### 14-20 秒

- 画面: 停在最漂亮的三四句
- 收尾文案: `emolitter / open source / local-first`

## 社交文案候选

### 中文短文案

我做了一个有点奇怪的小工具。

它会监听我在电脑前的一段日常, 但最后给我的不是统计图, 而是一封信。

窗口切换、键盘敲击、深夜里犹豫了一下又删掉的话, 最后都会被整理成一段像样的文字。

它叫 `emolitter`。

### 英文短文案

Built a small CLI called `emolitter`.

It watches a slice of your desktop activity and turns it into a literary letter instead of an analytics report.

Local-first, open source, and intentionally a little sentimental.

## 发布时最该强调的三件事

1. `Result-first`
不要先讲监听权限, 先讲最后生成的信。

2. `Local-first`
用户会天然担心隐私, 所以要早讲“本地生成、不上传”。

3. `Creative, not productivity`
不要硬说它能提升效率。它的价值在表达、记忆和作品感。

## 可直接引用的样张文件

- [gentle-maker.txt](../examples/gentle-maker.txt)
- [cinematic-midnight.txt](../examples/cinematic-midnight.txt)
- [minimal-office.txt](../examples/minimal-office.txt)
