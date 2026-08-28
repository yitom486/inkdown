# Markdown Editor

基于 Electron + React + shadcn/ui 的 Markdown 编辑器（学习项目）。

## 技术栈

- Bun — 包管理与脚本
- Electron + electron-vite — 桌面应用
- React + TypeScript — 前端
- Tailwind CSS + shadcn/ui — UI

## 快速开始

```bash
# 安装依赖
bun install

# 启动开发模式（热更新 + Electron 窗口）
bun run dev

# 构建
bun run build

# 打包为安装程序
bun run pack
```

## 项目结构

详见 [AGENTS.md](./AGENTS.md)。

## 添加 shadcn 组件

```bash
bunx shadcn@latest add dialog
```

> Windows 注意：若组件生成到 `@/` 目录而非 `src/components/ui/`，需手动移动到正确位置。
