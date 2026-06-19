# 跨平台看图 APP 开发文档（PRD + 技术决策）

> 文件名：`prd.md`  
> 版本：v1.0（开发前最终文档，已合并技术决策）  
> 日期：2026-06-19  
> 项目定位：轻量、快速、可靠的跨平台图片浏览与图片隐私/批处理工具  
> 首期平台：Windows 11、macOS 26+（Linux 降级为后续阶段）  
> 技术基线：**React + Electron + pnpm**（详见第 5 节）

---

## 1. 项目概述

本项目是一款面向 Windows、macOS（Linux 为后续阶段）的跨平台看图 APP，核心目标是提供轻量、快速、可靠的图片浏览体验，并内置图片管理、Exif 查看/擦除、批量重命名、格式转换、多图并列浏览等常用工具。

与普通图片查看器不同，本应用重点解决以下问题：

1. 用户经常需要快速浏览一个文件夹内的大量图片。
2. 用户需要查看图片的完整 Exif、XMP、IPTC、GPS、MakerNotes 等元信息。
3. 用户希望在分享图片前擦除隐私信息，例如 GPS、设备型号、拍摄时间、软件信息等。
4. 用户需要将图片保存到指定目录，并按照 MD5、SHA1 或自定义规则重命名。
5. 用户需要对文件夹内图片进行批量重命名、字符替换、排序编号。
6. 用户需要支持 HEIC、JPEG XL、AVIF、WebP、PNG、JPEG、TIFF 等多种格式之间的转换。
7. 用户需要一次并列查看 2 张、3 张或 4 张图片，并能按组快速切换多张图片，用于挑图、对比、筛选和快速浏览。

---

## 2. 为什么要做

### 2.1 用户痛点

现有看图工具通常分为两类：

一类是系统自带图片查看器，启动快，但功能较弱，通常不支持完整 Exif 查看、指定 Exif 擦除、批量处理、高级格式转换和多图并列对比。

另一类是专业图片管理软件，功能强，但体积大、学习成本高，很多用户只是想快速浏览文件夹、清理隐私信息、批量重命名、转换格式或并排比较几张图片。

本项目希望定位在两者之间：保留看图工具的轻量体验，同时内置高频实用功能。

### 2.2 核心价值

本 APP 的核心价值是：

- 打开文件夹后自动载入图片队列，方便连续浏览。
- 显示完整图片元信息，而不是只显示基础 Exif。
- 支持精确擦除指定 Exif 字段。
- 支持自动擦除模式，减少重复操作。
- 支持图片保存、重命名、批量重命名和格式转换。
- 支持现代图片格式，例如 HEIC、JPEG XL、AVIF。
- 支持 1 张、2 张、3 张、四宫格多图浏览模式。
- 支持一次快速切换多张图片，提高挑图和筛图效率。
- 支持跨平台运行，降低用户迁移成本。

---

## 3. 目标用户与典型场景

### 3.1 目标用户

- 普通用户：快速查看、整理和分享图片。
- 摄影爱好者：查看完整 Exif，按拍摄参数筛选照片。
- 内容创作者：批量清理隐私信息、转换格式、输出分享图。
- 设计/运营人员：快速对比多张素材，挑选最佳图片。
- 开发/测试人员：验证图片格式、编码信息、元信息字段。

### 3.2 典型场景

#### 场景 A：快速浏览文件夹

用户打开一个包含 1000 张图片的文件夹，应用快速显示首批结果，用户使用左右方向键连续浏览。

#### 场景 B：分享前清理隐私信息

用户打开照片，查看 GPS、设备型号、拍摄时间等字段，选择“隐私模式”导出新文件。

#### 场景 C：批量整理文件名

用户将文件夹内的 `IMG_0001.jpg`、`IMG_0002.jpg` 批量重命名为 `Nr:001.jpg`、`Nr:002.jpg`。

#### 场景 D：格式转换

用户将 WebP、HEIC、AVIF 图片批量转换为 JPEG 或 PNG，并选择是否保留 Exif。

#### 场景 E：多图并列挑图

用户进入四宫格模式，一屏同时查看 4 张图片，按一次快捷键切换到下一组 4 张，快速筛选相似照片。

---

## 4. 目标平台

### 4.1 桌面端

首期支持：

- Windows 11
- macOS 26+

后续阶段：

- Ubuntu / Debian / Fedora 等主流 Linux 发行版（架构上预留跨平台能力，不在 MVP 验收范围内）

### 4.2 架构目标

应用应采用跨平台桌面框架，但图片处理能力不应完全依赖前端或浏览器能力。

图片解码、格式转换、Exif 读写、批处理任务应放在主进程、Worker、原生模块或独立子进程中执行。

---

## 5. 技术选型（最终确定）

> 本节为开发前的最终技术决策。基线 **React + Electron + pnpm** 已确认，其余决策如下。版本号为推荐基线，初始化时以当前 stable 为准并锁定 lockfile。

### 5.1 最终技术栈

| 领域 | 选型 | 状态 |
|---|---|---|
| 桌面框架 | Electron | ✅ 已确认 |
| UI 框架 | React 19 + TypeScript | ✅ 已确认 |
| 包管理 | pnpm（workspace monorepo） | ✅ 已确认 |
| 构建工具 | electron-vite（Vite 驱动） | 决策 |
| 渲染进程状态 | Zustand | 决策 |
| 样式 | Tailwind CSS + Radix UI（headless） | 决策 |
| 图片处理 | sharp（libvips 绑定） | 决策 |
| 元信息引擎 | exiftool-vendored | 决策 |
| 本地缓存 DB | better-sqlite3 | 决策 |
| 重任务执行 | Node Worker Threads + 任务池 | 决策 |
| 图片传输 | 自定义协议 `gv-img://`（流式，不走 base64 IPC） | 决策 |
| IPC | contextBridge + 类型化 invoke 封装 | 决策 |
| 打包 | electron-builder | 决策 |
| Lint/格式化 | Biome | 决策 |
| 测试 | Vitest（单测） + Playwright（E2E，阶段二） | 决策 |

### 5.2 构建工具与工程结构

**构建工具：electron-vite**。三套构建目标（main / preload / renderer）统一在一个配置里，renderer 由 Vite + React 插件驱动。

- 原生支持 Electron 三进程结构，HMR 体验好（renderer 热更新，main/preload 自动重启）。
- 比手搓 Vite 多 entry 省事，比 Electron Forge 的 webpack 模板更快更轻。
- 与 pnpm monorepo 兼容良好。
- 否决项：Electron Forge（webpack 模板慢、配置重）、CRA（已弃用）、裸 Vite（需自己拼 main/preload 构建）。

**仓库结构（pnpm workspace）**，落地 §19.1：

```
folio/
├── pnpm-workspace.yaml
├── package.json              # 根：脚本、devDeps、biome、husky
├── apps/
│   └── desktop/              # electron-vite 工程
│       ├── electron.vite.config.ts
│       ├── src/
│       │   ├── main/         # 主进程：服务、调度器、协议、IPC handler
│       │   ├── preload/      # contextBridge
│       │   ├── workers/      # sharp / hash worker
│       │   └── renderer/     # React 应用
│       │       ├── components/
│       │       ├── features/ { viewer, multi-view, queue, exif, rename, convert, settings }
│       │       ├── stores/   # zustand
│       │       └── App.tsx
│       └── package.json
├── packages/
│   ├── core/                 # queue / naming / task / multi-view 纯逻辑（可单测）
│   ├── image-processing/     # sharp 封装、预览/缩略图策略
│   ├── shared-types/         # IPC 契约 + 数据类型
│   └── config/               # settings.json schema + 默认值
├── scripts/
└── docs/
```

**原则**：核心逻辑（队列计算、命名规则、多图分组、任务状态机）放 `packages/core`，**不依赖 Electron/React**，可纯函数单测 —— 契合「核心能力不被 UI 框架锁死」。

**工具链**：Biome（lint+format 二合一，比 ESLint+Prettier 快）、Vitest（`packages/core` 纯逻辑单测）、electron-builder（打包，注意原生模块 ABI 重建）、Playwright（E2E，阶段二）。

### 5.3 进程职责边界（核心架构原则）

```
渲染进程 (React)        主进程 (Node)              Worker 池
─────────────────      ──────────────────         ──────────────
UI / 交互               文件系统访问                sharp 解码/缩略图/预览图
队列状态展示            目录扫描（分批流式）        sharp 格式转换
多图布局                better-sqlite3 缓存         hash 计算 (md5/sha1)
快捷键                  exiftool 调度（持久进程）   （exiftool 自带进程池）
                        任务调度器                  批量重命名 fs 操作
                        自定义协议服务图片
```

**铁律**：

- 渲染进程**永不**直接读文件、永不同步解码大图、永不跑 hash/转换。
- 队列只存路径 + 索引元数据（见 `ImageQueueItem`），**不存原图二进制**。
- 所有耗时操作进入主进程 Task Scheduler，分发到 Worker。

### 5.4 核心架构决策

**① 图片传输：自定义协议而非 base64 IPC。** 主进程注册特权协议 `gv-img://`，渲染进程用 `<img src="gv-img://thumb/<id>">` / `gv-img://preview/<id>?w=...&h=...` / `gv-img://original/<id>` 加载。协议处理器返回文件流或 sharp 生成的预览流。

- 避免把图片读成 base64 经 IPC 传给渲染进程（内存翻倍、GC 压力大）——这是 Electron 看图器最常见的内存爆炸来源。
- `<img>` 走流式加载，可被 Chromium 缓存与回收，离屏图片资源自然释放。
- 预览图按需在协议层用 sharp 生成（命中缓存直接返回文件），契合 §10.4 预览缓存策略。
- 协议用 `protocol.registerSchemesAsPrivileged` 声明为 `standard + secure + supportFetchAPI + stream`。

**② 渲染进程状态：Zustand。** 管理队列、多图视图、Viewer、设置状态。轻量、无 Provider 嵌套、selector 精准订阅（多图模式下避免无关重渲染）。按类型分 slice：`queueStore` / `multiViewStore` / `viewerStore` / `settingsStore`。

**③ 样式：Tailwind CSS + Radix UI。** Tailwind 做布局/原子样式，Radix（headless）提供对话框、抽屉、右键菜单、下拉等可访问组件。看图器以自定义视觉为主，重量级组件库（MUI/AntD）反而是负担。

**④ 图片处理：sharp（libvips）。** 负责缩略图、预览图、格式转换，运行在 Worker Threads，主进程维护 Worker 池。内存低、流式处理大图、AVIF/WebP/TIFF/PNG/JPEG 开箱即用。HEIC/HEIF/JXL 见 §5.9 待验证项。

**⑤ 元信息引擎：exiftool-vendored。** 自带 ExifTool 二进制 + 持久 `-stay_open` 进程，避免每张图启动开销（满足 §14 Exif 摘要 <500ms），字段级擦除完整。

**⑥ 本地缓存：better-sqlite3。** 主进程同步访问，缓存最近文件夹、尺寸、hash、缩略图/预览图路径、Exif 摘要、批处理日志、自动规则。配置类用 `settings.json`（§10.1），结构化缓存用 SQLite（§10.2）。

**⑦ 任务系统：Worker Threads + 任务调度器。** Worker 池默认 `cpu - 1`，多图预览另设并发上限（避免四宫格同时解码 4 张 50MP）。任务带优先级（当前组预览 > 下一组预加载 > 后台缩略图）；Worker 返回前比对 `QueueState.version` 丢弃过期结果；快速翻组用 AbortSignal 取消过期预览任务。详见 §9.3。

**⑧ IPC：类型化 contextBridge。** preload 用 `contextBridge.exposeInMainWorld` 暴露按 §9.2 分组的 API（`image.*` / `queue.*` / `multiView.*` / `metadata.*` / `file.*` / `task.*`），底层统一走 `ipcRenderer.invoke`，类型定义放 `packages/shared-types` 共享。安全基线：`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`，渲染进程零文件系统权限。

### 5.5 为什么用 Electron

结论：Electron 性能足够，但必须合理设计架构。

Electron 适合承担：

- 跨平台 UI
- 文件夹选择
- 图片浏览界面
- 多图并列浏览界面
- 快捷键系统
- 队列管理
- 设置页
- 任务进度展示
- 调用底层图片处理工具

Electron 不适合直接承担：

- 大图完整解码
- 大量图片同步遍历
- 批量格式转换
- 大规模 Exif 写入
- 长时间 CPU 密集任务
- 在渲染进程一次性加载大量原图

因此，本项目不应把 Electron 当作“图片处理引擎”，而应把 Electron 当作“跨平台桌面壳 + UI 层 + 调度层”。

### 5.6 Electron 性能风险

主要风险包括：

1. 内存占用较高。
2. Chromium 渲染进程加载超大图片时可能出现卡顿。
3. 如果一次性读取整个文件夹所有原图，会导致内存暴涨。
4. 批处理任务如果运行在 UI 线程，会导致界面无响应。
5. HEIC、JPEG XL 等格式不能完全依赖浏览器原生支持。
6. 多图并列模式如果同时加载多张超大原图，会放大内存压力。

### 5.7 Electron 优化原则

必须遵守以下原则：

1. 图片队列只保存路径、文件大小、修改时间、缩略图路径、元信息摘要，不保存所有原图二进制。
2. 单图模式下，当前图片、上一张、下一张可以预加载，其他图片只保留索引。
3. 多图并列模式下，只加载当前组可见图片，以及下一组的轻量预览图。
4. 缩略图异步生成并缓存。
5. Exif 读取使用异步任务队列。
6. 批量擦除、批量重命名、格式转换必须放到独立 Worker 或子进程。
7. 大图展示时优先加载适配屏幕的预览图，而不是直接渲染超大原图。
8. 文件夹扫描要分批进行，避免一次性阻塞。
9. 任务系统需要支持暂停、取消、重试和错误记录。
10. 多图并列模式需要限制最大同时解码数量，避免四宫格下加载 4 张 50MP 原图造成卡顿。

### 5.8 替代方案 Tauri

如果对安装包体积和内存占用非常敏感，可以考虑 Tauri。

Tauri 包体通常更小，内存占用也可能更低，但需要 Rust 生态、系统 WebView 差异处理，以及更多平台兼容测试。

建议策略：

- MVP 阶段优先 Electron，开发效率高，生态成熟。
- 如果后续确认用户非常在意体积和内存，再评估 Tauri 版本。
- 图片处理核心能力应封装成独立模块，避免被 UI 框架绑定。

### 5.9 待定与需验证项

1. **HEIC/HEIF 显示与转换**：依赖 libvips heif（libheif），sharp 预编译包不一定包含。MVP 转换输出不含 HEIC（见第 16 节阶段二）；HEIC **读取用于显示**需在 M6 spike 验证，否则回退 ImageMagick 或明确提示不支持。
2. **JPEG XL** 支持路径列为阶段二。
3. **各平台原生模块**（sharp / better-sqlite3）在 electron-builder 下的 ABI 重建与签名（macOS notarization）——建议早做打包冒烟，勿拖到最后。
4. **是否引入 React Router**：MVP 倾向用 Zustand 的 `AppViewMode` 做视图切换，暂不引入路由库。

---

## 6. 产品功能范围

## 6.1 图片浏览

### 功能描述

用户可以打开单张图片，也可以打开一个文件夹。打开文件夹后，应用自动扫描目录内支持的图片文件，并生成浏览队列。

### 支持能力

- 打开单张图片。
- 打开文件夹。
- 支持拖拽文件或文件夹进入窗口。
- 自动识别文件夹内图片。
- 支持按名称、修改时间、创建时间、文件大小、格式排序。
- 支持上一张、下一张。
- 支持首张、末张。
- 支持随机查看。
- 支持缩放、适应窗口、原始尺寸。
- 支持旋转预览。
- 支持全屏查看。
- 支持删除到回收站。
- 支持在文件管理器中显示。
- 支持复制文件路径。
- 支持复制图片到剪贴板。
- 支持打开最近文件夹。

### 图片队列规则

打开文件夹时，系统应生成图片队列：

```ts
type ImageQueueItem = {
  id: string
  filePath: string
  fileName: string
  ext: string
  size: number
  width?: number
  height?: number
  modifiedAt: number
  createdAt?: number
  thumbnailPath?: string
  metadataStatus: "pending" | "loaded" | "failed"
}
```

队列不应存储原图二进制，只存储路径和必要索引。

---

## 6.2 多图并列浏览

### 功能描述

用户可以在同一窗口内并列显示多张图片，支持 2 张、3 张和四宫格模式。该功能用于快速挑图、比较构图、比较清晰度、比较相似照片，并支持一次切换多张图片。

### 目标

- 提高大量图片浏览效率。
- 支持一次查看多张连续图片。
- 支持按组快速切换，例如四宫格下一次切换 4 张。
- 支持在多图模式下快速选择当前焦点图片。
- 支持多图模式与 Exif、保存、删除、格式转换等工具联动。

### 显示模式

| 模式 | 名称 | 布局 | 一次切换数量 |
|---|---|---|---|
| 1 | 单图模式 | 1 张大图 | 1 张 |
| 2 | 双图模式 | 左右并列 2 张，可选上下排列 | 2 张 |
| 3 | 三图模式 | 左侧 1 张大图 + 右侧上下 2 张，或三列等宽 | 3 张 |
| 4 | 四宫格模式 | 2 x 2 网格 | 4 张 |

### 快速切换规则

在多图模式下，当前显示的是一个图片组：

```ts
type MultiViewGroup = {
  startIndex: number
  viewCount: 1 | 2 | 3 | 4
  itemIds: string[]
}
```

切换规则：

- 单图模式：下一张 = 当前索引 + 1。
- 双图模式：下一组 = 当前起始索引 + 2。
- 三图模式：下一组 = 当前起始索引 + 3。
- 四宫格模式：下一组 = 当前起始索引 + 4。
- 上一组规则相同，向前减少对应数量。
- 到达队列末尾时，默认显示剩余图片，空白格显示“无更多图片”。
- 可在设置中启用“循环浏览”，到末尾后回到队列开头。
- 删除、隐藏或过滤图片后，当前组应自动补齐后续图片。

### 焦点图片规则

多图并列模式中始终存在一张“焦点图片”。

焦点图片用于：

- 显示 Exif 面板。
- 执行单图保存。
- 执行单图 Exif 擦除。
- 执行单图删除。
- 复制文件路径。
- 在文件管理器中显示。
- 放大查看原图。

焦点切换方式：

- 鼠标点击某个格子。
- 数字键 `1`、`2`、`3`、`4` 选择对应格子。
- `Tab` 切换到下一个格子。
- `Shift + Tab` 切换到上一个格子。

焦点图片需要有明显边框、标题高亮或状态栏标识。

### 缩放与同步

多图并列模式支持两种缩放方式：

1. 独立缩放  
   每张图片独立缩放、平移，适合查看细节。

2. 同步缩放  
   所有格子同步缩放比例和位置，适合比较相似照片的清晰度和构图。

MVP 默认支持：

- 适应格子。
- 原始尺寸。
- 放大。
- 缩小。
- 焦点图独立缩放。
- 一键同步缩放开关。

增强版本支持：

- 同步平移。
- 锁定缩放比例。
- 对齐图片中心点。
- 按人脸/主体对齐。

### 图片操作联动

多图并列模式下，操作分为“焦点图片操作”和“当前组操作”。

焦点图片操作：

- 查看 Exif。
- 擦除 Exif。
- 保存到目标文件夹。
- 删除到回收站。
- 复制图片。
- 复制路径。
- 在文件夹中显示。

当前组操作：

- 当前组全部保存。
- 当前组全部擦除 Exif。
- 当前组全部加入批量转换。
- 当前组全部复制到目标目录。
- 当前组全部标记为选中。
- 当前组全部跳过或隐藏。

### UI 布局

#### 双图模式

```txt
┌──────────────────────┬──────────────────────┐
│ 图片 1               │ 图片 2               │
│                      │                      │
└──────────────────────┴──────────────────────┘
```

#### 三图模式

默认布局：

```txt
┌───────────────────────────┬──────────────────┐
│ 图片 1                    │ 图片 2           │
│                           ├──────────────────┤
│                           │ 图片 3           │
└───────────────────────────┴──────────────────┘
```

可选三列布局：

```txt
┌──────────────┬──────────────┬──────────────┐
│ 图片 1       │ 图片 2       │ 图片 3       │
└──────────────┴──────────────┴──────────────┘
```

#### 四宫格模式

```txt
┌──────────────────┬──────────────────┐
│ 图片 1           │ 图片 2           │
├──────────────────┼──────────────────┤
│ 图片 3           │ 图片 4           │
└──────────────────┴──────────────────┘
```

### 状态栏显示

多图模式状态栏应显示：

- 当前模式：单图 / 双图 / 三图 / 四宫格。
- 当前组范围：例如 `第 21 - 24 张 / 共 1000 张`。
- 当前焦点图片文件名。
- 当前焦点图片尺寸、格式、缩放比例。
- 当前组是否存在加载失败图片。
- 当前是否启用同步缩放。

### 快捷键

| 快捷键 | 功能 |
|---|---|
| `V` | 在单图、双图、三图、四宫格之间循环切换 |
| `Ctrl/Cmd + 1` | 单图模式 |
| `Ctrl/Cmd + 2` | 双图模式 |
| `Ctrl/Cmd + 3` | 三图模式 |
| `Ctrl/Cmd + 4` | 四宫格模式 |
| `→ / D` | 下一张或下一组 |
| `← / A` | 上一张或上一组 |
| `Shift + →` | 下一组 |
| `Shift + ←` | 上一组 |
| `1 / 2 / 3 / 4` | 选择对应格子为焦点图片 |
| `Tab` | 焦点切换到下一个格子 |
| `Shift + Tab` | 焦点切换到上一个格子 |
| `S` | 开关同步缩放 |
| `Enter` | 将焦点图片临时放大为单图查看 |
| `Esc` | 从临时单图返回多图模式 |

### 数据结构

```ts
type MultiViewMode = "single" | "dual" | "triple" | "quad"

type MultiViewLayout = 
  | "single"
  | "dual_horizontal"
  | "dual_vertical"
  | "triple_main_left"
  | "triple_equal_columns"
  | "quad_grid"

type MultiViewState = {
  mode: MultiViewMode
  layout: MultiViewLayout
  startIndex: number
  focusedSlot: 0 | 1 | 2 | 3
  syncZoom: boolean
  loopEnabled: boolean
  fillBlankSlots: boolean
  groupItemIds: string[]
  zoomByItemId: Record<string, number>
  panByItemId: Record<string, { x: number; y: number }>
}
```

### 队列加载策略

- 单图模式：当前图 + 前后各 1 张预加载。
- 双图模式：当前组 2 张 + 下一组缩略图/预览图预加载。
- 三图模式：当前组 3 张 + 下一组缩略图/预览图预加载。
- 四宫格模式：当前组 4 张 + 下一组缩略图/预览图预加载。
- 多图模式不允许一次性加载整个文件夹原图。
- 对 50MP 以上大图优先生成适配格子的预览图。
- 不可见格子的原图资源必须及时释放。

### 边界处理

- 当前文件夹不足 2/3/4 张时，显示已有图片，其他格子显示空白占位。
- 图片加载失败时，该格子显示错误状态，不影响其他格子。
- 删除焦点图片后，当前组自动补入下一张图片。
- 删除当前组多张图片后，队列重新计算当前组。
- 切换排序规则后，多图组从当前焦点图片所在位置重新生成。
- 递归目录模式下，按排序后的全局队列生成多图组。

### MVP 范围

MVP 需要实现：

1. 单图、双图、三图、四宫格模式切换。
2. 多图模式下一次切换对应数量图片。
3. 焦点图片选择。
4. 焦点图片查看 Exif。
5. 焦点图片保存、删除、复制路径。
6. 多图模式适应窗口。
7. 四宫格下 1000 张图片队列浏览不阻塞 UI。

增强版本再实现：

1. 同步缩放与同步平移。
2. 当前组批量保存。
3. 当前组批量 Exif 擦除。
4. 当前组批量格式转换。
5. 相似图片对比辅助。
6. 多图评分、收藏、标记。

---

## 6.3 支持格式

### 基础格式

- JPEG / JPG
- PNG
- WebP
- GIF
- BMP
- TIFF
- AVIF

### 现代格式

- HEIC
- HEIF
- JPEG XL / JXL

### 可选格式

- RAW：CR2、CR3、NEF、ARW、RAF、ORF、RW2、DNG
- SVG
- ICO
- PSD

RAW 格式可作为后续增强功能，不建议 MVP 阶段强制支持完整编辑能力。

---

## 6.4 Exif 信息查看

### 功能描述

用户可以查看当前图片的完整元信息，包括但不限于：

- EXIF
- GPS
- XMP
- IPTC
- MakerNotes
- ICC Profile
- 文件系统信息
- 图片编码信息
- 相机信息
- 镜头信息
- 拍摄参数
- 软件信息
- 缩略图信息

在多图并列模式下，Exif 面板默认显示焦点图片的元信息。

### 显示方式

Exif 面板应提供三种视图：

1. 摘要视图  
   展示常用字段，例如相机、镜头、拍摄时间、ISO、快门、光圈、焦距、GPS、图片尺寸。

2. 分组视图  
   按 EXIF、GPS、XMP、IPTC、MakerNotes、ICC 等分组显示。

3. 原始视图  
   显示完整 key-value 数据，支持搜索和复制。

### 搜索功能

Exif 面板应支持：

- 按字段名搜索。
- 按字段值搜索。
- 按分组筛选。
- 一键复制字段。
- 一键复制全部元信息为 JSON。

---

## 6.5 Exif 擦除

### 功能描述

用户可以选择擦除指定 Exif 信息，而不是只能全部清除。

### 擦除模式

支持以下模式：

1. 擦除全部元信息。
2. 只擦除 GPS 位置信息。
3. 只擦除设备信息。
4. 只擦除拍摄时间。
5. 只擦除软件信息。
6. 只擦除缩略图。
7. 只擦除自定义字段。
8. 保留指定字段，擦除其余字段。

### 常用预设

内置预设：

- 隐私模式：移除 GPS、设备序列号、拍摄时间、软件、缩略图。
- 分享模式：保留图片方向和色彩配置，移除隐私字段。
- 完全清理：移除所有可移除元信息。
- 保留版权：保留版权、作者、ICC Profile，移除 GPS 和设备信息。
- 自定义模板：用户自行选择字段并保存。

### 安全要求

Exif 擦除必须遵守：

1. 默认不覆盖原文件，除非用户明确选择。
2. 擦除前应生成预览差异。
3. 支持另存为新文件。
4. 支持保留原文件备份。
5. 批处理时必须显示成功、失败、跳过数量。
6. 擦除失败时不得删除原文件。
7. 对 HEIC、JXL、RAW 等格式需要明确提示支持程度。
8. 多图模式下默认只操作焦点图片；批量操作当前组时必须二次确认。

---

## 6.6 Exif 自动模式

### 功能描述

当用户在某个文件夹内对第一张图片启用 Exif 擦除后，应用应提供自动应用机制。

### 触发场景

用户在当前文件夹内打开第一张图片，选择擦除字段并执行后，弹出选项：

```txt
是否将本次 Exif 擦除规则应用到其他图片？

[仅当前图片]
[应用到当前文件夹全部图片]
[之后同目录图片自动应用]
[保存为默认规则]
```

### 自动模式范围

支持以下范围：

1. 当前图片。
2. 当前目录全部图片。
3. 当前目录及子目录全部图片。
4. 当前会话内同目录图片自动应用。
5. 永久规则：指定目录自动应用。
6. 全局默认规则：所有图片使用该规则。

### 自动模式规则结构

```ts
type ExifAutoRule = {
  id: string
  name: string
  enabled: boolean
  scope: "session_directory" | "directory" | "directory_recursive" | "global"
  directory?: string
  removeTags: string[]
  keepTags?: string[]
  mode: "remove_selected" | "remove_all_except_keep"
  applyOn: "manual_confirm" | "on_save" | "on_export" | "on_open"
  createdAt: number
  updatedAt: number
}
```

### 防误操作设计

自动模式必须提供：

- 明确的状态提示。
- 当前目录是否启用自动擦除的标识。
- 执行前确认。
- 可撤销或可恢复的备份机制。
- 批处理日志。
- 一键关闭自动模式。

---

## 6.7 保存到目标文件夹

### 功能描述

用户可以将当前图片保存到指定目标文件夹，并选择重命名规则。

多图模式下：

- 默认保存焦点图片。
- 可选择保存当前组全部图片。
- 保存当前组全部图片时必须显示任务预览。

### 保存方式

支持：

1. 保持原文件名。
2. 重命名为 MD5 + 原扩展名。
3. 重命名为 SHA1 + 原扩展名。
4. 使用自定义规则。
5. 使用序号规则。
6. 保存时自动擦除 Exif。
7. 保存时自动转换格式。

### 命名规则

支持变量：

```txt
{name}        原文件名，不含扩展名
{ext}         原扩展名
{md5}         文件 MD5
{sha1}        文件 SHA1
{date}        当前日期，YYYY-MM-DD
{time}        当前时间，HH-mm-ss
{mtime}       文件修改时间
{width}       图片宽度
{height}      图片高度
{index}       队列序号
{nr:001}      从 001 开始的序号
```

示例：

```txt
{md5}.{ext}
{sha1}.{ext}
{date}_{nr:001}.{ext}
{name}_{width}x{height}.{ext}
```

### 冲突处理

当目标文件已存在时，支持：

- 跳过。
- 覆盖。
- 自动追加序号。
- 弹窗询问。
- 对比 MD5，相同则跳过。

---

## 6.8 文件夹内批量重命名

### 功能描述

用户可以对当前文件夹或指定文件夹内图片进行批量重命名。

### 模式一：替换/删除指定字符

支持：

- 替换字符。
- 删除字符。
- 支持大小写敏感。
- 支持正则表达式。
- 支持仅作用于文件名，不作用于扩展名。
- 支持预览改名前后对比。

示例：

```txt
将 "IMG_" 替换为 ""
将 " " 替换为 "_"
删除 "(1)"
```

### 模式二：指定位置删除

支持：

- 从第 N 位开始删除 M 个字符。
- 删除前 N 个字符。
- 删除后 N 个字符。
- 从指定字符之前删除。
- 从指定字符之后删除。

示例：

```txt
删除前 4 个字符
从第 3 位开始删除 2 个字符
删除最后 6 个字符
```

### 模式三：按照排序重命名

支持按照当前排序，将文件重命名为：

```txt
Nr:001.jpg
Nr:002.jpg
Nr:003.jpg
```

可配置：

- 前缀：Nr
- 起始序号：1
- 序号位数：3
- 分隔符：:
- 是否保留原扩展名
- 是否按当前浏览排序
- 是否按名称、修改时间、创建时间、文件大小排序

### 批量重命名安全要求

1. 必须提供预览表格。
2. 必须检测重名冲突。
3. 必须检测非法文件名字符。
4. 必须支持撤销，或生成重命名日志。
5. 必须避免 A -> B、B -> A 这类循环重命名冲突。
6. 必须提供 dry-run 模式。
7. 操作失败不得影响未处理文件。

---

## 6.9 格式转换

### 功能描述

用户可以将当前图片或批量图片转换为其他格式。

多图模式下：

- 默认转换焦点图片。
- 可选择转换当前组全部图片。
- 可从当前组加入批量转换队列。

### 输入格式

建议支持：

- JPEG
- PNG
- WebP
- AVIF
- HEIC / HEIF
- JPEG XL / JXL
- TIFF
- BMP
- GIF

### 输出格式

MVP 推荐支持：

- JPEG
- PNG
- WebP
- AVIF
- TIFF

增强版本支持：

- HEIC
- JPEG XL
- PDF
- ICO

### 转换参数

JPEG：

- 质量
- 渐进式 JPEG
- 是否保留 Exif
- 是否保留 ICC Profile

PNG：

- 压缩等级
- 是否保留透明通道

WebP：

- 有损 / 无损
- 质量
- 压缩等级

AVIF：

- 质量
- 速度
- 色深

JPEG XL：

- 有损 / 无损
- 质量 / distance
- effort

HEIC：

- 质量
- 色彩空间
- 是否保留元信息

### 转换流程

```txt
选择图片 → 选择目标格式 → 设置参数 → 选择输出目录 → 预览任务 → 执行 → 显示结果
```

### 格式转换安全要求

1. 默认不覆盖原文件。
2. 转换失败保留原文件。
3. 批量转换支持取消。
4. 支持失败重试。
5. 支持保留目录结构。
6. 支持转换后自动打开目标文件夹。

---

## 7. 内置快捷功能

## 7.1 快捷键

默认快捷键建议：

| 快捷键 | 功能 |
|---|---|
| `← / A` | 上一张 / 上一组 |
| `→ / D` | 下一张 / 下一组 |
| `Space` | 适应窗口 / 原始尺寸切换 |
| `Ctrl/Cmd + O` | 打开图片 |
| `Ctrl/Cmd + Shift + O` | 打开文件夹 |
| `Ctrl/Cmd + S` | 保存到目标文件夹 |
| `Ctrl/Cmd + E` | 打开 Exif 面板 |
| `Ctrl/Cmd + Shift + E` | 擦除 Exif |
| `Ctrl/Cmd + R` | 批量重命名 |
| `Ctrl/Cmd + T` | 格式转换 |
| `Delete` | 删除到回收站 |
| `F11` | 全屏 |
| `+` | 放大 |
| `-` | 缩小 |
| `0` | 原始尺寸 |
| `1` | 多图模式下选择第 1 格；单图模式下可配置为适应窗口 |
| `2` | 多图模式下选择第 2 格 |
| `3` | 多图模式下选择第 3 格 |
| `4` | 多图模式下选择第 4 格 |
| `Ctrl/Cmd + 1` | 单图模式 |
| `Ctrl/Cmd + 2` | 双图模式 |
| `Ctrl/Cmd + 3` | 三图模式 |
| `Ctrl/Cmd + 4` | 四宫格模式 |
| `V` | 循环切换单图、双图、三图、四宫格 |
| `Shift + →` | 下一组图片 |
| `Shift + ←` | 上一组图片 |
| `Tab` | 多图模式下切换焦点格子 |
| `S` | 多图模式下开关同步缩放 |
| `G` | 显示 GPS 信息 |
| `I` | 显示图片信息 |

> 注：数字键在单图模式和多图模式下可能存在冲突，应在快捷键配置中允许用户自定义。

## 7.2 右键菜单

### 图片区域右键菜单

- 下一张 / 下一组
- 上一张 / 上一组
- 切换为单图模式
- 切换为双图模式
- 切换为三图模式
- 切换为四宫格模式
- 设为焦点图片
- 复制图片
- 复制文件路径
- 在文件夹中显示
- 查看 Exif
- 擦除 Exif
- 保存到目标文件夹
- 格式转换
- 删除到回收站

### 队列区域右键菜单

- 从队列移除
- 在文件夹中显示
- 批量选择同格式
- 批量转换
- 批量擦除 Exif
- 批量重命名
- 从当前图片开始以双图模式查看
- 从当前图片开始以三图模式查看
- 从当前图片开始以四宫格模式查看

## 7.3 工具栏快捷按钮

顶部工具栏建议包含：

- 打开文件
- 打开文件夹
- 上一张 / 下一张
- 上一组 / 下一组
- 单图 / 双图 / 三图 / 四宫格切换
- 缩放
- 旋转
- Exif
- 擦除隐私信息
- 保存到目标文件夹
- 批量重命名
- 格式转换
- 设置

---

## 8. UI 设计

## 8.1 主界面布局

```txt
┌──────────────────────────────────────────────┐
│ 顶部工具栏                                   │
├───────────────┬──────────────────────────────┤
│ 图片队列 /    │                              │
│ 缩略图列表    │         图片预览区域          │
│               │   单图 / 双图 / 三图 / 四宫格 │
├───────────────┴──────────────────────────────┤
│ 状态栏：文件名 / 尺寸 / 格式 / 缩放 / Exif状态 │
└──────────────────────────────────────────────┘
```

## 8.2 多图并列浏览布局

### 双图模式

```txt
┌───────────────┬───────────────┐
│ 图片 A        │ 图片 B        │
│ 文件名/尺寸   │ 文件名/尺寸   │
└───────────────┴───────────────┘
```

### 三图模式

```txt
┌─────────────────────┬───────────────┐
│ 图片 A              │ 图片 B        │
│                     ├───────────────┤
│                     │ 图片 C        │
└─────────────────────┴───────────────┘
```

### 四宫格模式

```txt
┌───────────────┬───────────────┐
│ 图片 A        │ 图片 B        │
├───────────────┼───────────────┤
│ 图片 C        │ 图片 D        │
└───────────────┴───────────────┘
```

### 视觉要求

- 焦点图片必须有明显边框。
- 每个格子底部可显示文件名、尺寸、格式。
- 加载中显示骨架屏或轻量 spinner。
- 加载失败显示错误原因。
- 空白格显示“无更多图片”。
- 工具栏显示当前多图模式。
- 状态栏显示当前组范围。

## 8.3 Exif 面板

Exif 面板可以作为右侧抽屉：

```txt
┌────────────────────────────┐
│ Exif 信息                   │
├────────────────────────────┤
│ 当前焦点图片：xxx.jpg       │
├────────────────────────────┤
│ 搜索字段                    │
├────────────────────────────┤
│ 摘要 / 分组 / 原始           │
├────────────────────────────┤
│ GPS                         │
│ Camera                      │
│ Lens                        │
│ DateTime                    │
│ XMP                         │
└────────────────────────────┘
```

## 8.4 批处理任务页

批处理页需要显示：

- 当前任务类型。
- 总文件数。
- 已完成数量。
- 失败数量。
- 当前处理文件。
- 进度条。
- 错误列表。
- 暂停按钮。
- 取消按钮。
- 导出日志按钮。

---

## 9. 系统架构

## 9.1 模块划分

```txt
App
├── UI Layer
│   ├── Image Viewer
│   ├── Multi View Viewer
│   ├── Queue Panel
│   ├── Exif Panel
│   ├── Batch Rename Dialog
│   ├── Format Convert Dialog
│   └── Settings
│
├── Main Process
│   ├── File System Service
│   ├── Queue Service
│   ├── Multi View Service
│   ├── Task Scheduler
│   ├── IPC Bridge
│   └── Config Service
│
├── Worker / Child Process
│   ├── Metadata Worker
│   ├── Thumbnail Worker
│   ├── Preview Image Worker
│   ├── Rename Worker
│   ├── Convert Worker
│   └── Hash Worker
│
├── Native / CLI Tools
│   ├── ExifTool
│   ├── libvips / sharp
│   └── optional ImageMagick
│
└── Storage
    ├── SQLite
    ├── Thumbnail Cache
    ├── Preview Cache
    ├── Config JSON
    └── Task Logs
```

## 9.2 IPC 通信

渲染进程不能直接访问文件系统，应通过安全 IPC 调用主进程能力。

示例接口：

```ts
image.openFile(path)
image.openDirectory(path)
image.getPreview(filePath, options)
image.convert(options)

queue.getItems()
queue.setSortMode(mode)
queue.getGroup(startIndex, count)

multiView.setMode(mode)
multiView.getState()
multiView.setFocusedSlot(slot)
multiView.nextGroup()
multiView.previousGroup()
multiView.toggleSyncZoom()

metadata.read(filePath)
metadata.remove(filePath, rule)

file.saveToTarget(options)
file.batchRename(options)

task.cancel(taskId)
task.pause(taskId)
task.resume(taskId)
```

## 9.3 任务系统

所有耗时操作统一进入 Task Scheduler：

```ts
type Task = {
  id: string
  type:
    | "metadata_read"
    | "metadata_remove"
    | "rename"
    | "convert"
    | "hash"
    | "thumbnail"
    | "preview"
  status: "pending" | "running" | "paused" | "success" | "failed" | "cancelled"
  total: number
  completed: number
  failed: number
  createdAt: number
  updatedAt: number
  logs: TaskLog[]
}
```

### 多图模式任务约束

- 多图模式的预览图生成任务优先级高于后台缩略图生成。
- 当前组预览任务优先级高于下一组预加载任务。
- 用户快速翻组时，应取消过期的预览任务。
- Worker 返回结果前需要校验当前队列版本，避免旧结果覆盖新状态。

---

## 10. 数据存储

## 10.1 配置文件

保存用户设置：`settings.json`

内容包括：

- 默认打开目录。
- 默认保存目录。
- 默认排序规则。
- 默认 Exif 擦除规则。
- 自动模式规则。
- 快捷键配置。
- 多图浏览默认模式。
- 多图浏览默认布局。
- 是否启用循环浏览。
- 是否启用同步缩放。
- 格式转换默认参数。
- 主题设置。
- 缩略图缓存大小。
- 预览图缓存大小。

示例：

```json
{
  "defaultOpenDirectory": "",
  "defaultSaveDirectory": "",
  "sortMode": "name_asc",
  "defaultMultiViewMode": "single",
  "multiView": {
    "loopEnabled": false,
    "syncZoom": false,
    "tripleLayout": "triple_main_left",
    "dualLayout": "dual_horizontal"
  },
  "thumbnailCacheSizeMB": 1024,
  "previewCacheSizeMB": 2048
}
```

## 10.2 SQLite

SQLite 用于缓存：

- 最近打开文件。
- 最近打开文件夹。
- 图片尺寸。
- 文件 hash。
- 缩略图路径。
- 预览图路径。
- Exif 摘要。
- 批处理日志。
- 自动规则。
- 多图浏览最近模式。

## 10.3 缩略图缓存

缩略图缓存目录：

```txt
AppData / Application Support / .cache / thumbnails
```

缓存 key：

```txt
hash(filePath + fileSize + modifiedAt)
```

当文件修改时间变化时，缩略图缓存失效。

## 10.4 预览图缓存

预览图用于大图和多图并列模式。

缓存目录：

```txt
AppData / Application Support / .cache / previews
```

缓存 key：

```txt
hash(filePath + fileSize + modifiedAt + targetWidth + targetHeight + colorProfileMode)
```

预览图要求：

- 不替代原图。
- 可按屏幕或格子尺寸生成。
- 文件修改后自动失效。
- 四宫格模式优先使用预览图，降低内存占用。

---

## 11. Exif 擦除策略

## 11.1 标签选择

常见隐私字段：

```txt
GPS*
SerialNumber
CameraSerialNumber
LensSerialNumber
InternalSerialNumber
DateTimeOriginal
CreateDate
ModifyDate
Software
OwnerName
Artist
UserComment
ThumbnailImage
PreviewImage
MakerNotes
```

## 11.2 默认隐私模式

默认隐私模式建议移除：

```txt
GPS*
SerialNumber*
*Serial*
OwnerName
Artist
UserComment
DateTimeOriginal
CreateDate
ModifyDate
Software
ThumbnailImage
PreviewImage
```

保留：

```txt
Orientation
ColorSpace
ICC_Profile
ImageWidth
ImageHeight
```

## 11.3 操作策略

提供两种方式：

1. 原地修改  
   适合高级用户，需要确认和备份。

2. 导出新文件  
   默认推荐方式，安全性更高。

---

## 12. 错误处理

### 文件错误

- 文件不存在。
- 文件被占用。
- 权限不足。
- 文件名非法。
- 目标路径不可写。

### 图片错误

- 格式不支持。
- 文件损坏。
- 解码失败。
- 元信息读取失败。
- 元信息写入失败。
- 多图模式中部分图片加载失败。

### 批处理错误

- 部分文件失败。
- 重名冲突。
- 转换失败。
- 用户取消。
- 磁盘空间不足。

所有错误必须写入任务日志，并允许用户导出。

---

## 13. 安全与隐私

1. 应用默认离线运行。
2. 不上传用户图片。
3. 不收集 Exif 信息。
4. 不自动扫描非用户指定目录。
5. 自动擦除模式必须明确提示。
6. 原文件覆盖必须二次确认。
7. 批处理操作必须有预览。
8. 所有外部工具调用必须转义路径参数，避免命令注入。
9. 用户配置中不得保存敏感文件内容。
10. 多图模式批量操作当前组图片时必须明确提示操作范围。

---

## 14. 性能指标

## 14.1 MVP 性能目标

- 打开普通 JPEG：小于 300ms。
- 打开包含 1000 张图片的文件夹：3 秒内显示首批结果。
- 缩略图异步加载，不阻塞浏览。
- 切换上一张 / 下一张：小于 100ms，预加载命中时。
- 双图 / 三图 / 四宫格切换下一组：小于 150ms，预览缓存命中时。
- Exif 摘要读取：小于 500ms。
- UI 在批处理期间保持可操作。
- 单进程内存长期稳定，不因浏览大量图片持续增长。
- 四宫格模式下连续浏览 1000 张图片，不应出现持续内存增长。

## 14.2 大图策略

对于超大图片，例如 50MP 以上图片：

- 优先生成屏幕尺寸预览图。
- 多图模式优先生成格子尺寸预览图。
- 仅在用户选择 100% 原始尺寸时加载高分辨率图。
- 限制同时保留的原图数量。
- 释放不可见图片资源。
- 对缩放和平移使用虚拟化或分块加载策略。

---

## 15. MVP 范围

第一阶段建议实现：

1. 打开图片。
2. 打开文件夹并生成图片队列。
3. 上一张 / 下一张浏览。
4. 基础缩放、适应窗口、原始尺寸。
5. 单图 / 双图 / 三图 / 四宫格浏览模式。
6. 多图模式下一次快速切换 2/3/4 张图片。
7. 多图模式焦点图片选择。
8. Exif 完整查看。
9. 指定 Exif 字段擦除。
10. 当前目录自动应用擦除规则。
11. 保存到目标文件夹。
12. MD5 / SHA1 重命名。
13. 简单批量重命名。
14. JPEG / PNG / WebP / AVIF 格式转换。
15. 缩略图缓存。
16. 预览图缓存。
17. 任务日志。

---

## 16. 第二阶段功能

1. HEIC / HEIF 完整转换支持。
2. JPEG XL 完整转换支持。
3. RAW 预览。
4. 批量 Exif 模板。
5. 递归目录处理。
6. 批量撤销。
7. 自定义快捷键。
8. 插件系统。
9. 颜色管理增强。
10. 图片对比模式增强。
11. 双图 / 三图 / 四宫格同步缩放和平移。
12. 收藏夹。
13. 标签系统。
14. 重复图片检测。
15. 相似图片聚类。
16. 当前组评分与筛选。
17. 多图模式按人脸/主体辅助对齐。

---

## 17. 验收标准

## 17.1 图片浏览

- 能打开单张图片。
- 能打开文件夹并自动载入图片队列。
- 能顺畅切换图片。
- 文件夹内 1000 张图片时 UI 不应卡死。
- 不支持格式应提示明确错误。

## 17.2 多图并列浏览

- 能在单图、双图、三图、四宫格之间切换。
- 双图模式可同时显示 2 张连续图片。
- 三图模式可同时显示 3 张连续图片。
- 四宫格模式可同时显示 4 张连续图片。
- 双图模式点击下一组时，图片索引前进 2 张。
- 三图模式点击下一组时，图片索引前进 3 张。
- 四宫格模式点击下一组时，图片索引前进 4 张。
- 多图模式下可通过鼠标点击或数字键选择焦点图片。
- Exif 面板显示当前焦点图片的信息。
- 文件夹末尾图片不足时，空白格显示“无更多图片”。
- 某一张图片加载失败时，不影响其他格子显示。
- 四宫格模式连续切换 1000 张图片时 UI 不应卡死。
- 多图模式不应一次性加载所有原图。

## 17.3 Exif

- 能查看完整元信息。
- 能搜索字段。
- 能擦除指定字段。
- 能擦除 GPS。
- 能擦除后验证字段已移除。
- 自动模式能应用到同目录图片。
- 自动模式可关闭。
- 多图模式下默认只操作焦点图片。
- 当前组批量 Exif 操作必须有确认和日志。

## 17.4 保存与重命名

- 能保存到指定目标文件夹。
- 能按 MD5 命名。
- 能按 SHA1 命名。
- 能按自定义规则命名。
- 批量重命名前有预览。
- 重名冲突能被检测。
- 操作失败不会破坏原文件。
- 多图模式下可保存焦点图片。
- 多图模式下保存当前组全部图片前必须显示预览。

## 17.5 格式转换

- 能转换 JPEG、PNG、WebP、AVIF。
- 转换任务可取消。
- 转换失败有错误提示。
- 原文件默认不被覆盖。
- 能选择是否保留 Exif。
- 多图模式下可将焦点图片加入转换任务。
- 多图模式下可将当前组图片加入转换任务，并显示任务预览。

---

## 18. 推荐开发里程碑

### Milestone 1：基础看图

- 项目初始化。
- 主窗口。
- 打开文件。
- 打开文件夹。
- 图片队列。
- 上一张 / 下一张。
- 缩放与适应窗口。

### Milestone 2：多图并列浏览

- Multi View Viewer 组件。
- 单图 / 双图 / 三图 / 四宫格模式。
- 下一组 / 上一组切换。
- 焦点图片选择。
- 状态栏当前组范围显示。
- 多图模式下的预览图加载策略。
- 多图模式下资源释放策略。

### Milestone 3：Exif 系统

- 接入 ExifTool。
- Exif 完整读取。
- Exif 面板。
- 字段搜索。
- 指定字段擦除。
- 擦除结果验证。
- 多图模式下焦点图片 Exif 联动。

### Milestone 4：自动模式

- Exif 擦除规则。
- 当前目录自动应用。
- 批处理任务系统。
- 日志系统。
- 防误操作确认。

### Milestone 5：保存与重命名

- 保存到目标文件夹。
- MD5 / SHA1 命名。
- 自定义命名规则。
- 批量重命名。
- 重命名预览。
- 冲突检测。
- 多图模式当前组保存入口。

### Milestone 6：格式转换

- 接入 libvips / sharp。
- JPEG / PNG / WebP / AVIF 转换。
- HEIC / JPEG XL 支持验证。
- 批量转换。
- 转换参数设置。
- 多图模式当前组加入转换任务。

### Milestone 7：性能优化与发布

- 缩略图缓存。
- 预览图缓存。
- 图片预加载。
- 大图优化。
- 多图模式内存优化。
- 批量任务优化。
- 打包 Windows / macOS（electron-builder；注意 sharp / better-sqlite3 原生模块 ABI 重建与 macOS 公证）。
- 自动更新。
- 崩溃日志。

---

## 19. 开发启动建议

### 19.1 仓库结构（pnpm workspace）

```txt
folio
├── pnpm-workspace.yaml
├── package.json              # 根：脚本、devDeps、biome、husky
├── apps
│   └── desktop               # electron-vite 工程
│       ├── electron.vite.config.ts
│       ├── src
│       │   ├── main          # 主进程：服务、调度器、协议、IPC handler
│       │   ├── preload       # contextBridge
│       │   ├── workers       # sharp / hash worker
│       │   └── renderer      # React 应用
│       │       ├── components
│       │       ├── features
│       │       │   ├── viewer
│       │       │   ├── multi-view
│       │       │   ├── queue
│       │       │   ├── exif
│       │       │   ├── rename
│       │       │   ├── convert
│       │       │   └── settings
│       │       └── stores    # zustand
│       └── package.json
│
├── packages
│   ├── core                  # queue / metadata / naming / task / multi-view 纯逻辑（可单测）
│   ├── image-processing      # sharp 封装、预览/缩略图策略
│   ├── shared-types          # IPC 契约 + 数据类型
│   └── config                # settings.json schema + 默认值
│
├── scripts
├── docs
│   └── prd.md
└── README.md
```

### 19.2 首批技术任务

1. 初始化 Electron + 前端框架项目。
2. 设计主进程、preload、renderer 的安全 IPC 边界。
3. 实现文件打开和目录扫描。
4. 实现图片队列和排序。
5. 实现单图 Viewer。
6. 实现 Multi View Viewer。
7. 实现双图、三图、四宫格布局。
8. 实现上一张 / 下一张 / 上一组 / 下一组。
9. 接入缩略图生成与缓存。
10. 接入预览图生成与缓存。
11. 接入 ExifTool 读取元信息。
12. 建立 Task Scheduler 基础能力。
13. 建立任务日志结构。
14. 建立设置页和快捷键配置。

### 19.3 首批核心类型

```ts
type SortMode =
  | "name_asc"
  | "name_desc"
  | "modified_asc"
  | "modified_desc"
  | "created_asc"
  | "created_desc"
  | "size_asc"
  | "size_desc"
  | "format_asc"

type QueueState = {
  directory?: string
  items: ImageQueueItem[]
  currentIndex: number
  sortMode: SortMode
  version: number
}

type ViewerState = {
  currentItemId?: string
  zoom: number
  fitMode: "fit_window" | "original_size" | "custom"
  rotation: 0 | 90 | 180 | 270
}

type AppViewMode = "viewer" | "batch_tasks" | "settings"
```

### 19.4 首批接口验收

```ts
await image.openDirectory(directoryPath)
await queue.getItems()
await queue.setSortMode("name_asc")
await multiView.setMode("quad")
await multiView.nextGroup()
await multiView.previousGroup()
await metadata.read(filePath)
await file.saveToTarget(options)
```

### 19.5 MVP 发布前检查清单

- Windows 11、macOS 26+ 均可完成基础安装和启动。
- 打开 1000 张图片文件夹不阻塞 UI。
- 四宫格模式连续切换不会明显内存上涨。
- Exif 读取失败不会导致图片浏览失败。
- 擦除 Exif 默认导出新文件，不覆盖原图。
- 批处理操作有预览、确认、日志。
- 外部工具路径参数安全转义。
- 不上传用户图片。
- 不自动扫描用户未选择目录。

---

## 20. Electron 性能结论

Electron 可以胜任本项目，但前提是图片处理架构必须正确。

正确做法是：

- UI 用 Electron。
- 文件扫描异步化。
- 图片处理放 Worker 或子进程。
- Exif 使用 ExifTool。
- 图片转换使用 libvips / sharp。
- 队列只存索引，不存原图。
- 缩略图缓存。
- 预览图缓存。
- 大图使用预览图策略。
- 多图模式只加载当前组和必要预加载资源。
- 批处理任务不能阻塞 UI。

不建议的做法是：

- 在渲染进程同步读取图片。
- 一次性载入整个文件夹所有原图。
- 用浏览器原生能力处理所有格式。
- 在 UI 线程跑 hash、Exif 写入、格式转换。
- 多图并列模式直接加载多张超大原图。
- 批处理时不提供取消和日志。

最终建议：

MVP 使用 Electron 是合理的。

如果后续产品重点变成“极致轻量、低内存、原生体验”，再考虑 Tauri 或原生客户端。

无论选择 Electron 还是 Tauri，图片解码、Exif、格式转换、多图并列浏览的资源调度都应抽象成独立处理层，避免 UI 框架锁死核心能力。
