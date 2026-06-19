# GalleryViewer — Agent 指南

> 通用项目说明,适用于任意 AI 编码助手(Claude Code / codex / 等)。
> Claude Code 专属内容见 `CLAUDE.md`(已 `@` 引用本文件)。

## 项目是什么

跨平台看图 APP:轻量、快速、可靠的图片浏览 + 内置 Exif 查看/隐私擦除、批量重命名、格式转换、**多图并列浏览**(差异化核心)。

- 完整需求 + 技术决策:**`docs/prd.md`**(开发前最终文档,v1.0)
- MVP 任务清单 / 里程碑:**`docs/mvp-tasks.md`**
- UI 原型:**`.dev/design/GalleryViewer.dc.html`**(见下方「设计系统」)

**当前状态**:M0 之前,仓库尚无代码,只有文档与设计原型。首个任务是脚手架(见 `docs/mvp-tasks.md` 的 M0)。

## 技术栈

| 领域 | 选型 |
|---|---|
| 桌面框架 | Electron |
| UI | React 19 + TypeScript |
| 包管理 | pnpm(workspace monorepo) |
| 构建 | electron-vite |
| 渲染进程状态 | Zustand |
| 样式 | Tailwind CSS + Radix UI(headless) |
| 图片处理 | sharp(libvips),跑在 Worker Threads |
| 元信息 | exiftool-vendored(持久进程) |
| 本地缓存 | better-sqlite3(主进程) |
| 图片传输 | 自定义协议 `gv-img://`(流式,**不走 base64 IPC**) |
| 打包 | electron-builder |
| Lint/格式化 | Biome |
| 测试 | Vitest |

首期平台:**Windows 11、macOS 26+**(Linux 为后续阶段)。详见 `docs/prd.md` 第 5 节。

## 架构铁律(违反即返工)

1. **三进程边界**:渲染进程(React)永不直接读文件、永不同步解码大图、永不跑 hash/Exif 写入/格式转换。这些都在主进程或 Worker 里。
2. **队列只存索引**:图片队列只保存路径 + 元数据(见 prd `ImageQueueItem`),**绝不保存原图二进制**。
3. **图片用 `gv-img://` 协议加载**:渲染进程用 `<img src="gv-img://...">`,禁止把图片读成 base64 经 IPC 传递(内存爆炸主因)。
4. **耗时操作进 Task Scheduler**:缩略图/预览/转换/hash/批处理统一调度到 Worker,带优先级与取消,不阻塞 UI。
5. **核心逻辑放 `packages/core`**:队列计算、命名规则、多图分组、任务状态机等纯逻辑不依赖 Electron/React,必须可被 Vitest 单测。
6. **多图模式内存红线**:只加载当前组原图 + 下一组轻量预览;离屏格子资源及时释放;限制同时解码数量。

## 仓库结构(pnpm workspace)

```
galleryviewer/
├── apps/desktop/          # electron-vite 工程
│   └── src/{main,preload,workers,renderer}
│       └── renderer/{components,features,stores}
│           └── features/{viewer,multi-view,queue,exif,rename,convert,settings}
├── packages/
│   ├── core/              # 纯逻辑:queue/metadata/naming/task/multi-view(可单测)
│   ├── image-processing/  # sharp 封装、预览/缩略图策略
│   ├── shared-types/      # IPC 契约 + 数据类型(main 与 renderer 共享)
│   └── config/            # settings.json schema + 默认值
└── docs/                  # prd.md, mvp-tasks.md
```

## 常用命令(M0 脚手架完成后可用)

```bash
pnpm install        # 安装依赖
pnpm dev            # 启动 Electron(三进程 HMR)
pnpm test           # Vitest 单测(主要覆盖 packages/core)
pnpm lint           # Biome 检查
pnpm format         # Biome 格式化
pnpm build          # electron-builder 打包
```
> 这些脚本在 M0 建立 `package.json` 后生效;在此之前不要假设它们存在。

## 代码约定

- TypeScript 全程;IPC 契约类型集中放 `packages/shared-types`,main/preload/renderer 共享同一份。
- IPC 按命名空间分组:`image.*` / `queue.*` / `multiView.*` / `metadata.*` / `file.*` / `task.*`(见 prd §9.2)。
- Electron 安全基线:`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`;preload 仅用 `contextBridge`。
- 渲染进程状态按 slice 拆:`queueStore` / `multiViewStore` / `viewerStore` / `settingsStore`。
- 写代码前对齐周边风格(命名、注释密度、目录习惯);纯逻辑优先放 `packages/core` 并补单测。

## 设计系统(来自 `.dev/design/GalleryViewer.dc.html`)

macOS 原生深色风格。原型用 `.dc.html`(Design Component)格式编写,**仅供视觉/交互参考,非生产代码**;落地时用 React + Tailwind 重写。原型目前只覆盖**单图模式**,多图并列需按 prd §6.2 自行设计。

**配色**
- 背景层级:`#1C1C1E`(标题栏/工具栏/卡片) · `#161618`(队列/胶片/抽屉) · `#0E0E0F`(设置页) · 画布为 `#000` 径向渐变
- 强调色:`#0A84FF`(可配置)
- 文本:`#fff` 主 · `rgba(235,235,245,0.6/0.5/0.4/0.3)` 次级递减
- 语义色:含隐私 `#FF9F0A`(橙) · 已清理/成功 `#32D7A0`(绿) · 危险/覆盖 `#FF453A`(红) · 中性 `#8E8E93`
- Exif 分组色:EXIF `#0A84FF` · GPS `#FF453A` · Date `#FF9F0A` · XMP/IPTC `#32D7A0` · File `#8E8E93`

**排版**:正文 SF Pro Text / 系统字体;元数据与数字用等宽 SF Mono / Menlo + `tabular-nums`。

**形状**:按钮圆角 8px,卡片 10–12px,弹窗 16px,胶囊/圆点 9999px;分隔线 `rgba(255,255,255,0.06)`,行分隔 `rgba(84,84,88,0.4)`。

**布局**:标题栏(交通灯,38px)→ 工具栏(48px)→ 中部 [左队列 288px | 画布 | Exif 抽屉 332px] → 状态栏(28px);可选底部胶片条(108px)替代左队列。变体 prop:`accent` / `queueLayout(left|bottom)` / `density(cozy|compact)`。

**关键交互**:队列项隐私小圆点(橙/绿/灰);Exif 抽屉三视图(Summary/Grouped/Raw)+ 字段搜索 + 行内删除态(`— removed` 绿色删除线);擦除弹窗预设 + 字段勾选 + 「导出新文件」开关,关闭时显示**原地覆盖红色警告**。

## 安全与隐私(硬性要求,见 prd §13)

1. 默认离线,不上传用户图片,不收集 Exif,不扫描用户未指定目录。
2. Exif 擦除/格式转换/保存**默认导出新文件,绝不覆盖原图**;原地覆盖必须二次确认。
3. 批处理必须有预览 + 确认 + 日志;失败不得破坏/删除原文件。
4. 所有外部工具(exiftool 等)调用必须安全处理路径参数,杜绝命令注入。
5. 批量重命名须 dry-run、检测重名/非法字符/循环冲突(A→B,B→A)。
