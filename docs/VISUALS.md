# Visual System

这份文档定义 `emoletter` 的视觉层表达。

目标不是做一个“像模板一样正确”的开源封面,
而是让项目看起来像一件被认真做过、也值得被记住的作品。

## 视觉方向

关键词:

- 信纸
- 余温
- 夜色
- 桌面灯光
- 文学感
- 数字时代的手写错觉

应该给人的感觉:

- 不是效率软件
- 不是工程工具官网
- 更像一张带有终端痕迹的数字明信片

## 色彩建议

- 主背景: 温暖纸色、焦糖、棕红、夜色褐
- 辅助高亮: 焦糖橙、奶油白
- 避免: 冷蓝科技风、纯黑极客风、紫色 AI 默认风

## 字体建议

- 标题: 衬线字体优先, 要有文学感
- 命令 / 技术信息: 等宽字体
- 正文 / 样张: 仍然建议用有书卷感的中文衬线字体

## 仓库头图

可直接使用:

- [assets/github-hero.svg](../assets/github-hero.svg)

推荐文案:

- 主标题: `把你一天的桌面日常, 写成一封真正能读下去的信`
- 副标题: `Not a time tracker. A letter from your digital day.`
- 角标: `emo sample --stdout`

## 社媒封面

可直接使用:

- [assets/social-cover.svg](../assets/social-cover.svg)

推荐场景:

- GitHub 仓库社媒预览
- 小红书首图
- B 站视频封面底图
- X / Twitter 分享配图

## 封面图排版文案

### 方案 A

- 主标题: `A letter from your digital day`
- 副标题: `不是效率看板, 而是一封来自桌面生活的信`

### 方案 B

- 主标题: `我做了一个会替桌面写信的 CLI`
- 副标题: `local-first / creative tool / open source`

### 方案 C

- 主标题: `Not a time tracker`
- 副标题: `A small open source tool that rewrites ordinary desktop life as a letter`

## 首屏 GIF 脚本

详细脚本见:

- [docs/GIF_SCRIPT.md](./GIF_SCRIPT.md)

最短版本:

1. 终端输入 `emo showcase --to "小王" --kind someone --length standard --theme midnight`
2. 输出 bundle 已生成
3. 打开 `index.html` 总览页
4. 打开 cinematic 样张开头
5. 停在最有镜头感的一段
6. 收尾到 `此致 敬礼`

## 视觉使用建议

1. GitHub README 头图用 `github-hero.svg`
2. 社媒封面用 `social-cover.svg`
3. GIF 不要超过 12 秒
4. GIF 里先给结果, 再给命令
5. 任何图里都优先展示“信的正文”, 不优先展示实现细节
