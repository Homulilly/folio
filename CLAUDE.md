# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

通用项目说明(项目概述、技术栈、架构铁律、仓库结构、命令、约定、设计系统、安全要求)见:

@AGENTS.md

> ⚠️ AGENTS.md 写于建仓初期,「当前状态:M0 之前,仓库尚无代码」一句已过时。**实际进度:M0(脚手架)+ M1(基础看图:打开/扫描、队列、单图查看)已落地**,见 `docs/mvp-tasks.md` 各里程碑下的范围/顺延说明与 M1 注记。

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

## 已落地架构(读多文件才看得出的约定,新实例先记这些)

### IPC 契约单一来源 — `packages/shared-types/src/ipc.ts`
- 全部通道名集中在 `IpcChannel` 常量(`namespace:method`,如 `image:openFileDialog`);**main(`ipc.ts`)与 preload(`preload/index.ts`)都从这里 import,不要在任一端硬编码字符串**。
- 渲染进程可见的 API 形状是 `FolioApi` 接口;preload 把它(加一个 DOM-local 的 `getPathForFile`)合成 `Bridge` 类型,经 `contextBridge.exposeInMainWorld('gv', …)` 暴露为 `window.gv`。
- `env.d.ts` 直接 `import type { Bridge } from '../../preload'` 来声明 `Window.gv`——**类型从 preload 反向引用,新增 API 改一处即可全链路生效**:在 `IpcChannel` 加通道 → `FolioApi` 加方法 → main 注册 handler → preload 转发。
- 主进程 handler 全部在 `registerIpcHandlers(getWindow)` 内注册;窗口相关操作通过传入的 `getWindow()` 拿当前窗口,别持有全局 window 引用。

### 图片加载走 `gv-img://`,不走 IPC
- URL 形状:`gv-img://<variant>/<absolute-path>`,**variant 是 host**(`original` | `thumb` | `preview`)。当前仅 `original` 实现(流式 `createReadStream`),`thumb`/`preview` 返回 501,待 M7 接 sharp。
- scheme 在 `protocol.ts` 用 `registerSchemesAsPrivileged` 声明,**必须在 app `ready` 之前调用**(`index.ts` 顶层已调)。
- Windows 路径修正:`/C:/…` 开头会去掉前导斜杠(见 `protocol.ts`,对应 commit `263c698`)。
- 渲染进程零 fs 访问;拖拽文件拿绝对路径用 preload 的 `webUtils.getPathForFile`(Electron 已移除 `File.path`)。

### 扫描与队列
- `services/scan.ts` 的 `buildScanResult(paths)` 统一入口:单目录→扫该目录;单图片→扫其所在文件夹并把该图设为 `currentIndex`;多路径→只收其中受支持的图片。**扫描非递归**,只读 stat、不碰图片字节,并发受 `mapLimit` 限流。
- 受支持扩展名的唯一来源是 `@folio/image-processing` 的 `SUPPORTED_EXTENSIONS`;判断用 `isSupportedImage` / `extOf`,勿另写一份。
- 队列 / viewer 状态在 `renderer/src/stores`(`queueStore` / `viewerStore` / `toastStore`),纯排序/分组逻辑在 `packages/core`(`sortItems`、`nextGroupStart` 等,带 Vitest)。`queueStore.version` 每次 mutation 自增,供后续 worker 丢弃过期结果(PRD §9.3)。

### electron-vite 配置坑(`electron.vite.config.ts`)
- `electron` 是 devDependency,需在 main/preload 的 `rollupOptions.external` 里**显式 external**,否则会打包 npm 启动桩、触发二进制下载。
- preload 输出强制为 **`.cjs`**(`format: 'cjs'`)——根 `"type": "module"` 下 sandbox preload 必须是 CommonJS;`index.ts` 里 preload 路径也写的是 `../preload/index.cjs`。
- renderer 有 alias `@renderer` → `src/renderer/src`。
- typecheck 分两份:`tsconfig.node.json`(main/preload)+ `tsconfig.web.json`(renderer);`pnpm typecheck` 跑全包,`@folio/desktop` 的 `typecheck` 会两份都跑。
