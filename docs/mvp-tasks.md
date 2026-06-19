# MVP 任务清单

> 文件名：`mvp-tasks.md`
> 版本：v1.0
> 日期：2026-06-19
> 配套：`prd.md`（需求 + 技术决策，第 5 节）
> 范围：覆盖 PRD §15 MVP 范围 + §18 里程碑 M1–M7

图例：`[ ]` 待办 · `[~]` 进行中 · `[x]` 完成 · 🔴 阻塞性风险点

---

## M0 — 项目脚手架与基础设施

- [x] 初始化 pnpm workspace（`pnpm-workspace.yaml` + 根 `package.json`）
- [x] 用 electron-vite 创建 `apps/desktop`，跑通空窗口（main/preload/renderer 三进程 HMR）
- [x] 安全基线：`contextIsolation` / 关 `nodeIntegration` / 开 `sandbox`
- [x] 建 `packages/shared-types`，落地 PRD 核心类型（`ImageQueueItem`/`QueueState`/`SortMode`/`MultiViewState`/`ViewerState`/`Task`）
- [x] 建 `packages/core`、`packages/image-processing`、`packages/config` 包 + tsconfig（core 已含首个单测，image-processing 含格式判定，config 含 settings 默认值）
- [x] 配置 Biome（lint+format）、Vitest、TypeScript
- [x] 类型化 IPC 框架：preload contextBridge + main invoke 路由 + 共享契约类型（`system` 命名空间）
- [x] 注册自定义协议 `gv-img://` 骨架（先直接返回原文件流）

**验收**：✅ `pnpm typecheck` / `pnpm test`(8 passed) / `pnpm build` / `pnpm lint` 全绿；✅ `pnpm dev` 正常启动 Electron 窗口,contextBridge IPC(`window.gv.system.ping`)打通。

> 实际栈版本:Electron 42 · electron-vite 5 · Vite 8 · React 19 · Tailwind 4 · TypeScript 6 · Biome 2.5 · Vitest 4 · Node 25 / pnpm 11。
> M0 踩坑记录:
> 1. pnpm 11 用 `pnpm-workspace.yaml` 的 `allowBuilds` 审批原生构建脚本;Electron 二进制下载若被跳过,跑 `electron/install.js` 补回。
> 2. tsconfig 采用 bundler 解析、不依赖 project-reference 输出。
> 3. `electron` 是 devDependency,externalizeDepsPlugin 不会自动 external,需在 main/preload 的 `rollupOptions.external` 显式声明,否则其 launcher stub 被打包进主进程并尝试下载二进制。
> 4. sandbox 渲染进程的 preload 必须是 CommonJS;`"type": "module"` 下 `.js` 为 ESM 会被静默拒绝(`window.gv` 变 undefined),preload 须输出 `.cjs`。

---

## M1 — 基础看图（PRD §6.1）

- [x] `image.openFileDialog` / `openDirectoryDialog` / `openPaths` IPC（打开单文件聚焦其所在目录）
- [x] 主进程目录扫描（并发 stat，识别支持格式，只存路径元数据不读原图）
- [x] 拖拽文件/文件夹进窗口（preload `webUtils.getPathForFile`）
- [x] `queueStore`（Zustand）：items / currentIndex / sortMode / version
- [x] 排序：名称/修改时间/创建时间/大小/格式（`setSortMode`，纯逻辑在 `core`，含单测）
- [x] 单图 Viewer：通过 `gv-img://` 显示，适应窗口 / 原始尺寸 / 缩放 / 旋转 + 拖拽平移
- [x] 导航：上一张/下一张/首张/末张/随机
- [x] 全屏（F11）、删除到回收站、文件管理器中显示、复制路径、复制图片、最近文件夹（右键菜单 + 快捷键）
- [x] 状态栏：文件名/尺寸/格式/缩放/位置
- [x] 基础快捷键系统（PRD §7.1 单图相关键位）

**验收**（PRD §17.1）：✅ typecheck/test(13)/lint/build 全绿，`pnpm dev` 启动无错。
> M1 范围说明 / 顺延项：
> - **缩略图**：队列栏暂为文字行（文件名+大小+格式），缩略图异步生成与缓存按计划放 M7；同理大队列**虚拟化**留待 M7（当前一次性渲染所有行）。
> - **前后预加载**：M1 直接用 `gv-img://` 由 Chromium 解码;显式预加载与 <100ms 命中目标随 M7 预览/缓存策略一起做。
> - **格式覆盖**：JPEG/PNG/WebP/GIF/BMP/AVIF/SVG/ICO 由 Chromium 原生解码;HEIC/HEIF/TIFF/JXL 显示占位提示，待 M6/M7 接入 sharp 预览。
> - **图片尺寸**：队列元数据 `width/height` 仍为 pending，状态栏尺寸取自 `<img>` 实际解码值;扫描期读取尺寸留给 M3 元信息。
> - **设置/i18n 临时方案**：当前已提前加入设置页与轻量 i18n，语言选择(`zh-CN`/`en`)暂由 renderer `localStorage`(`folio.settings.language`)持久化；M7 正式 settings.json 落地时需迁移到 `packages/config` 的 `AppSettings.language`，并保留一次性读取旧 key 的兼容迁移。

---

## M2 — 多图并列浏览（PRD §6.2）⭐ 差异化核心

- [x] `multiViewStore`：mode/layout/syncZoom/loopEnabled/expanded + 导航方法
- [x] 模式切换：单/双/三/四宫格（`V` 循环、`Ctrl/Cmd+1..4`）
- [x] 布局：双图(横/竖)、三图(左大右二/三列)、四宫格 2×2（工具栏「Swap layout」切换变体）
- [x] 分组切换：下一组/上一组按 viewCount 步进（`→/←`、`Shift+←/→`、`D/A`）
- [x] 焦点图片：点击 / 数字键 1-4 / Tab / Shift+Tab，焦点明显边框（蓝色 ring）
- [x] 边界：末尾空白格显示「No more images」；循环浏览开关；单格加载失败不影响其他格
- [x] 每格底部显示文件名/格式/大小；加载中 spinner；失败错误态（尺寸待 M3 元信息）
- [x] 状态栏：当前模式 / 组范围（第 X-Y 张/共 N）/ 焦点信息 / Sync 指示
- [x] `Enter` 焦点临时放大为单图，`Esc` 返回
- [ ] 🔴 **预览图加载策略**：只加载当前组原图 + 下一组轻量预览；50MP+ 优先格子尺寸预览 → **顺延 M7**
- [x] 🔴 **资源释放策略**：只挂载当前组原图,离屏格子 `<img>` 卸载交还解码位图(基础达成;主动预览/预加载随 M7)
- [ ] 多图预览任务接入调度器（优先级 + 翻组取消过期任务）→ **顺延 M7**

> M2 范围说明 / 顺延项：
> - **架构**：焦点图唯一真源是 `queueStore.currentIndex`,当前组由 `groupStartForIndex` **派生**(`packages/core/src/multi-view.ts`,含单测)。删除/排序/队列栏点击因此自动重算当前组,单图模式即 `viewCount=1`,无需维护重复索引。
> - **缩放**：复用 `viewerStore` 的 fit/zoom——焦点格缩放,开 Sync 时全格同步(`scale()` 居中)。**同步平移、按中心/主体对齐、锁定比例、格内 pan 为增强项,暂缺**。
> - **预览/预加载/调度器**(🔴 + 调度器项)：依赖 sharp 预览/缩略图管线,与 M1 已顺延的缩略图/预加载一并放 **M6/M7**;M2 仅挂载当前组原图(满足「不一次性加载全部原图 + 内存不持续增长」)。
> - **状态栏组内失败汇总**、**当前组批量操作**(全部保存/擦除/转换)：增强项,随 M4/M5/M6 联动。

**验收**（PRD §17.2）：四宫格连续切换 1000 张 UI 不卡死、内存不持续增长；各模式步进数正确；不一次性加载全部原图。

---

## M3 — Exif 查看系统（PRD §6.4）

- [ ] 接入 exiftool-vendored（持久进程），`metadata.read(filePath)`
- [ ] Exif 读取任务进调度器（异步队列，失败不影响浏览）
- [ ] Exif 面板（Radix 右侧抽屉）：摘要 / 分组 / 原始 三视图
- [ ] 搜索：按字段名/值、按分组筛选
- [ ] 复制单字段 / 复制全部为 JSON
- [ ] 多图模式：面板默认显示焦点图片元信息（联动 focusedSlot）
- [ ] SQLite 缓存 Exif 摘要

**验收**（PRD §17.3）：完整元信息可看可搜；Exif 读取失败不致浏览失败；多图下显示焦点图信息。

---

## M4 — Exif 擦除 + 自动模式 + 任务系统（PRD §6.5 / §6.6）

- [ ] Task Scheduler 完整化：状态机 + 进度 + 暂停/取消/重试 + 日志
- [ ] 批处理任务页（PRD §8.4）：进度条/已完成/失败/当前文件/错误列表/导出日志
- [ ] `metadata.remove(filePath, rule)`：字段级擦除
- [ ] 擦除模式：全部/GPS/设备/时间/软件/缩略图/自定义/保留指定
- [ ] 内置预设：隐私模式 / 分享模式 / 完全清理 / 保留版权（PRD §11.2）
- [ ] 🔴 安全：默认导出新文件不覆盖原图；擦除前预览差异；失败不删原文件
- [ ] 擦除后验证字段已移除
- [ ] 自动模式：当前目录应用 + 弹窗选项 + `ExifAutoRule` 结构 + 状态提示 + 一键关闭
- [ ] 多图：默认只操作焦点图；批量当前组须二次确认 + 日志

**验收**（PRD §17.3）：能擦 GPS/指定字段并验证移除；默认不覆盖原图；自动模式可应用同目录、可关闭；批量有确认+日志。

---

## M5 — 保存到目标 + 批量重命名（PRD §6.7 / §6.8）

- [ ] hash Worker：MD5 / SHA1
- [ ] `file.saveToTarget(options)`：保持原名/MD5/SHA1/自定义/序号
- [ ] 命名模板引擎（`packages/core/naming`）：`{name}{ext}{md5}{sha1}{date}{time}{mtime}{width}{height}{index}{nr:001}`
- [ ] 冲突处理：跳过/覆盖/追加序号/询问/MD5 比对
- [ ] `file.batchRename(options)`：替换删除字符（含正则）/ 指定位置删除 / 按排序编号
- [ ] 🔴 重命名安全：预览表格 + 重名检测 + 非法字符检测 + 循环冲突(A→B,B→A)避免 + dry-run + 日志
- [ ] 多图：保存焦点图；保存当前组前显示任务预览

**验收**（PRD §17.4）：MD5/SHA1/自定义命名；批量重命名有预览+冲突检测；失败不破坏原文件；多图当前组保存前有预览。

---

## M6 — 格式转换（PRD §6.9）

- [ ] convert Worker（sharp）：输出 JPEG / PNG / WebP / AVIF / TIFF
- [ ] 转换参数：JPEG(质量/渐进/保留Exif/ICC)、PNG(压缩/透明)、WebP(有损无损/质量)、AVIF(质量/速度/色深)
- [ ] 转换流程 UI：选图→格式→参数→输出目录→预览任务→执行→结果
- [ ] 🔴 安全：默认不覆盖原文件；失败保留原文件；批量可取消；失败重试；保留目录结构
- [ ] 转换后可打开目标文件夹
- [ ] 多图：焦点图加入转换 / 当前组加入转换队列（带预览）
- [ ] 🔴 **spike**：验证 sharp libvips 的 HEIC 读取与（阶段二）输出可行性，确定回退方案

**验收**（PRD §17.5）：JPEG/PNG/WebP/AVIF 转换可用；任务可取消、有错误提示；默认不覆盖；可选保留 Exif；多图当前组可入队并预览。

---

## M7 — 缓存、性能优化与发布（PRD §6 缓存 / §14 / §18）

- [ ] 缩略图缓存：Worker 异步生成，key=`hash(path+size+mtime)`，目录 `.cache/thumbnails`
- [ ] 预览图缓存：key 含目标尺寸+色彩模式，目录 `.cache/previews`，mtime 变化失效
- [ ] 缓存大小上限管理（settings：thumbnail/previewCacheSizeMB）
- [ ] 图片预加载策略调优（单图前后、各多图模式下一组）
- [ ] 大图策略：50MP+ 优先屏幕/格子预览，仅 100% 时加载原图，限制同时保留原图数
- [ ] 多图模式内存优化收尾 + 长时浏览内存稳定性测试
- [ ] 设置页（PRD §10.1 settings.json）+ 快捷键配置
  - [ ] 将当前 renderer `localStorage` 语言设置迁移到主进程 `settings.json`（字段：`AppSettings.language`），启动时若发现旧 key `folio.settings.language` 则写入 settings 后清理/忽略旧值
  - [ ] 为 settings 增加类型化 IPC（读取/更新/重置），renderer 不再直接承担正式持久化；设置页仅调用 settings store/API
  - [ ] 迁移后确保 i18n 初始化顺序稳定：先读 settings，再渲染 UI；读取失败时回退系统语言，不阻塞看图
- [ ] electron-builder 打包 Windows / macOS / Linux（原生模块 ABI + macOS 公证）
- [ ] 崩溃日志

**验收**（PRD §17 全量 + §19.5 发布清单）：三平台可装可启；1000 张不阻塞；四宫格连切不涨内存；擦除默认导出新文件；批处理有预览/确认/日志；不上传图片、不扫未选目录。

---

## 关键风险登记（贯穿全程）

| # | 风险 | 缓解 | 关联里程碑 |
|---|---|---|---|
| R1 | 多图模式内存爆炸 | 自定义协议流式 + 离屏释放 + 并发解码上限 + 预览图 | M2/M7 |
| R2 | HEIC/JXL 支持不确定 | M6 spike，MVP 不输出 HEIC，必要时回退/提示 | M6 |
| R3 | 原生模块跨平台构建 | 早做 electron-builder 打包验证（别拖到 M7） | M0/M7 |
| R4 | 大文件夹扫描阻塞 | 主进程分批流式 + 队列版本号 | M1 |
| R5 | 批处理误删/覆盖原文件 | 默认导出新文件 + dry-run + 二次确认 + 日志 | M4/M5/M6 |

---

## 建议执行顺序与并行

1. **M0 必须先行**（脚手架 + 类型契约 + 协议骨架）。
2. **M1 → M2** 是主线（看图 → 多图，差异化价值最早可演示）。
3. **建议把 R3（打包验证）提前到 M0/M1 之间做一次冒烟**，避免原生模块问题拖到最后。
4. M3/M4（Exif）与 M5（保存重命名）逻辑相对独立，`packages/core` 的命名/分组纯逻辑可随时并行开发 + 单测。
5. M7 性能优化贯穿始终，但缓存与打包正式收口放最后。
