# CLAUDE.md

通用项目说明(项目概述、技术栈、架构铁律、仓库结构、命令、约定、设计系统、安全要求)见:

@AGENTS.md

以下为 **Claude Code 专属** 补充。

## 善用内置 skill / agent

| 场景 | 用什么 |
|---|---|
| M0 脚手架搭好后生成/刷新本文档 | `/init` |
| 查 Electron / electron-vite / sharp / exiftool / Zustand 等库的最新 API | Context7 MCP(已连接,优先于凭记忆作答) |
| 启动 Electron 看实际效果 | `run` skill |
| 验证某改动真能跑(如「打开文件夹」) | `verify` skill |
| 提交前审 diff 找 bug | `code-review` skill |
| 审 IPC / 路径注入等安全问题(对应 prd §13) | `security-review` skill |
| 跨文件检索 / 拆里程碑实现方案 | `Explore` / `Plan` 子代理 |

## 工作习惯

- 动代码前先读 `docs/prd.md` 对应章节与 `docs/mvp-tasks.md` 的当前里程碑,按里程碑顺序推进(M0→M7)。
- 涉及 Electron 三进程、IPC、原生模块(sharp/better-sqlite3)时,版本/配置先用 Context7 核对,别凭记忆。
- 改动落地后,纯逻辑(`packages/core`)补 Vitest;涉及安全边界的改动跑一遍 `security-review`。
- UI 实现参考 `.dev/design/` 原型的设计 token,但用 React + Tailwind 重写——原型是 `.dc.html` 参考,非生产代码,且只覆盖单图模式。
