# emolitter

`emolitter` 是一个带点文艺幽默感的命令行工具。

它会在后台记录你的键盘动作和窗口切换，再把这些日常操作整理成一封写给某个人的书信，自动保存到桌面。

## 安装

本地开发安装：

```bash
npm install
npm install -g .
```

如果已经发布到 npm：

```bash
npm install -g emolitter
```

## 使用

启动监听：

```bash
emo open
```

或直接指定收信人：

```bash
emo open --to "小王"
```

结束监听并生成书信：

```bash
emo close
```

## 生成效果

- 文件名格式：`致{收信人}_{日期}_{总结}.txt`
- 文件保存位置：用户桌面
- 正文格式：
  - 以 `致亲爱的{收信人}：` 开头
  - 中间按时间顺序记录事件
  - 末尾附上 `此致`、`敬礼` 和生成时间

## 功能特性

- `emo open` 会询问“你想给什么人写信？”
- `emo close` 会停止后台监听并生成书信
- 后台监听使用独立进程，不打断当前工作
- 使用 PID 文件和状态文件避免重复启动
- 键盘事件会转成文艺描述
- 窗口切换会被写成“踏入某个领地”的句子
- 支持 Windows、macOS、Linux

## 平台说明

- Windows、macOS、Linux 都可以运行
- macOS 通常需要辅助功能权限
- Linux 下窗口监听依赖桌面环境；Wayland 对活动窗口检测支持有限
- 全局键盘监听可能会被系统安全策略、杀毒软件或权限设置拦截

## 发布

本地打包：

```bash
npm pack
```

发布到 npm：

```bash
npm publish
```
