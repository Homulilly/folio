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
- [x] **资源释放策略**：只挂载当前组原图,离屏格子 `<img>` 卸载交还解码位图(基础达成;主动预览/预加载随 M7)
- [ ] 多图预览任务接入调度器（优先级 + 翻组取消过期任务）→ **顺延 M7**

> M2 范围说明 / 顺延项：
> - **架构**：焦点图唯一真源是 `queueStore.currentIndex`,当前组由 `groupStartForIndex` **派生**(`packages/core/src/multi-view.ts`,含单测)。删除/排序/队列栏点击因此自动重算当前组,单图模式即 `viewCount=1`,无需维护重复索引。
> - **缩放**：复用 `viewerStore` 的 fit/zoom——焦点格缩放,开 Sync 时全格同步(`scale()` 居中)。**同步平移、按中心/主体对齐、锁定比例、格内 pan 为增强项,暂缺**。
> - **预览/预加载/调度器**(🔴 + 调度器项)：依赖 sharp 预览/缩略图管线,与 M1 已顺延的缩略图/预加载一并放 **M6/M7**;M2 仅挂载当前组原图(满足「不一次性加载全部原图 + 内存不持续增长」)。
> - **状态栏组内失败汇总**、**当前组批量操作**(全部保存/擦除/转换)：增强项,随 M4/M5/M6 联动。

**验收**（PRD §17.2）：四宫格连续切换 1000 张 UI 不卡死、内存不持续增长；各模式步进数正确；不一次性加载全部原图。

---

## M3 — Exif 查看系统（PRD §6.4）

- [x] 接入 exiftool-vendored（持久进程），`metadata.read(filePath)`
- [x] Exif 读取任务进调度器（异步队列，失败不影响浏览）— 复用 exiftool-vendored 内置进程池/队列;完整 Task Scheduler 集成随 M4
- [x] Exif 面板（右侧抽屉）：摘要 / 分组 / 原始 三视图（React+Tailwind 重写,未引入 Radix）
- [x] 搜索：按字段名/值、按分组筛选（输入分组名展开整组）
- [x] 复制单字段 / 复制全部为 JSON
- [x] 多图模式：面板默认显示焦点图片元信息（订阅 `queueStore.currentIndex` 即焦点图，单/多图通用）
- [x] SQLite 缓存 Exif 摘要（**已于 M7-A 完成**：`services/metaCache.ts` 的 `exif` 表作 L2 持久层,坐在主进程内存 L1 之后,mtime 失效 + 行数 LRU）

**验收**（PRD §17.3）：✅ typecheck/test(39)/lint/build 全绿,`pnpm dev` 启动无错;exiftool 真实读取（family-0 `-G0` 分组键）经核心纯函数转换可看可搜;读取失败返回 null、不致浏览失败;多图下面板跟随焦点图。
> M3 范围说明 / 顺延项：
> - **分层**：纯逻辑（`buildExifGroups`/`summarizeExif`/`filterExifGroups`/`exifToJsonString`）在 `packages/core`（含 Vitest）;主进程 `services/exiftool.ts` 仅薄封装 exiftool-vendored 的 `readRaw(file, {readArgs:['-G0']})`,值预先字符串化后下发,渲染进程不碰原始 tag 联合类型。
> - **IPC**：新增 `metadata:read` 通道与一个通用 `clipboard:writeText`(复制字段/JSON);契约仍单一来源于 `packages/shared-types`。
> - **缓存**：主进程内存 LRU(按 path+mtime 失效)代替 SQLite;持久化 Exif 摘要随缩略图/预览/hash 统一入库放 **M7**。
> - **调度器**：M3 仅靠 exiftool-vendored 内置批处理队列满足「异步队列 + 失败不影响浏览」;状态机/优先级/取消的完整 Task Scheduler 是 **M4** 范围。
> - **面板**：按现有组件风格用 React + Tailwind 重写(队列栏同款),暂不引入 Radix;待 M4 擦除确认弹窗等真正需要无障碍弹层时再评估。
> - **打包坑**：`electron-vite` 必须把 `exiftool-vendored` 显式 `external`(否则其源码被 inline,导致 vendored 二进制按模块路径定位失效);生产环境二进制还需 electron-builder `asarUnpack`,留 **M7**。

---

## M4 — Exif 擦除 + 自动模式 + 任务系统（PRD §6.5 / §6.6）

> 四个阶段全部落地：**A 擦除基础 + B 擦除弹窗 + C 任务调度器/批处理页 + D 自动模式**;持久化相关项(自动规则永久 scope、Exif 摘要缓存)统一顺延 M7。

### 已完成（Phase A — 擦除基础）

- [x] `metadata.erase(filePath, rule, target)`：字段级擦除（remove_selected / remove_all_except_keep 两种模式）
- [x] 擦除模式：全部/GPS/设备/唯一ID/时间/软件/缩略图/描述/作者版权（核心按「分类」组合,见 `ERASE_CATEGORIES`;`ImageUniqueID` 独立常驻分类,description 分类含 `Caption-Abstract` 等）
- [x] 自定义字段（PRD §6.5 mode 7）：弹窗内自由输入标签（`parseTagList` 校验,无效项忽略并提示），叠加在勾选分类之上
- [~] 保留指定字段（PRD §6.5 mode 8）：核心 `remove_all_except_keep` + keepTags 已支持,目前仅经 分享/完全 预设暴露;字段级 keep-list 编辑器待后续
- [x] 内置预设：隐私 / 分享 / 完全清理 / 保留版权 / 自定义（`presetRule` + `CATEGORY_PRESETS` 单一来源,PRD §11.2）
- [x] 安全：默认导出新文件不覆盖原图（拒绝覆盖已存在目标 + 失败清理半成品副本）；就地覆盖保留 `_original` 备份；失败绝不动原文件
- [x] 擦除后验证字段已移除（`verifyRemoval`,擦除后重读比对,残留则告警）
- [x] 标签模式校验防命令注入（`isValidTagPattern`;exiftool-vendored 以参数数组传递,本身不过 shell）

### 已完成（Phase B — 擦除弹窗）

- [x] 居中模态擦除弹窗（`EraseDialog`）：预设行 + 8 类勾选 + 自定义标签输入 + 擦除前差异预览（`partitionExifByRule`,显示将移除/保留项与字段名）
- [x] 输出选项：导出新文件（默认,`-noexif` 后缀同目录,冲突自动递增,原图即备份）/ 就地覆盖（无备份销毁性操作,红色警告 + 红色确认按钮二次确认）
- [x] 入口：Exif 抽屉底部「擦除元信息」;就地擦除后抽屉自动重读
- [x] `file:suggestExportPath` IPC（主进程计算无冲突导出路径）

### 已完成（Phase C — 任务调度器 + 批处理页）

- [x] Task Scheduler 完整化：状态机 + 进度 + 暂停/取消/重试 + 日志（PRD §9.3）— 纯状态机 `packages/core/task.ts`（合法迁移表 + 计数 + 派生视图,12 单测）;主进程 `services/taskScheduler.ts` 负责执行(逐文件 erase、文件间检查暂停/取消、失败项重试)
- [x] 批处理任务页（PRD §8.4）：进度条/已完成/失败/当前文件/错误列表/导出日志 + 暂停·继续·取消·重试（`BatchTasksPage`,经 `AppViewMode` 的 `batch_tasks` 视图路由,工具栏出现任务入口 + 运行指示点）
- [x] 当前文件夹 / 当前组批量擦除接入调度器（擦除弹窗新增「应用范围」段:当前图片 / 当前组 / 文件夹;组、夹走 `task:startEraseBatch` 并跳转批处理页）
- [x] 多图：默认只操作焦点图（已是默认）;批量就地覆盖须二次确认（按钮二次点击 arm）+ 日志（PRD §13.10）

### 已完成（Phase D — 自动模式，PRD §6.6）

- [x] 自动模式：首张擦除后弹出「应用到其他图片?」（`AutoModePrompt`）：仅当前 / 当前文件夹全部（走批处理）/ 本文件夹本会话自动应用
- [x] `ExifAutoRule` 结构（`shared-types`,记录完整目标形态）+ 会话级 `session_directory` 落地（`autoModeStore`,内存态）
- [x] 自动应用：开启后在该目录内导航到未处理图片时**自动导出去元信息副本**（`useAutoErase`,始终 export-new、永不动原图,故浏览触发安全）
- [x] 防误操作：顶部琥珀色状态条（`AutoModeStrip`,显示规则 + 目录）+ 一键关闭；首张提示每目录只弹一次
- [x] 持久化「存为默认规则」（**已于 M7-D 完成**：擦除对话框记住上次 preset/分类/自定义标签 → `settings.defaultErase`,下次预填）。**全局/递归 scope(directory_recursive/global)经评估刻意不做**（会在每个浏览过的文件夹散落导出副本,UX 风险大;跨图应用仍走 session-directory 自动模式）

**验收**（PRD §17.3）：能擦 GPS/指定字段并验证移除（✅ A）；默认不覆盖原图（✅ A/B）；自动模式可应用同目录、可关闭（✅ D）；批量有确认+日志（✅ C）。
> M4 范围说明：
> - **分层**：擦除规则/预设/校验/差异/验证 + 任务状态机纯逻辑全在 `packages/core`（`erase.ts` + `task.ts`,共 37 单测）;主进程 `services/exiftool.ts` 的 `eraseMetadata` 负责单文件 fs 编排（copyFile→strip→verify）,`services/taskScheduler.ts` 负责批处理执行与生命周期。
> - **exiftool 写入**：`remove_selected` 走 `write(file,{},{writeArgs:['-tag=',…]})`;`remove_all_except_keep` 走 `deleteAllTags(file,{retain})`。导出/无备份就地追加 `-overwrite_original`,保留备份则不加（exiftool 自动留 `_original`）。写入参数已 headless 验证（GPS/设备剥离、Orientation 保留、原图不变）。
> - **任务推送**：批处理进度走新的 main→renderer 推送通道 `task:update`（每次 mutation 推全量任务快照）,preload 经 `task.onUpdate(cb)` 订阅;其余仍是 invoke 请求/响应。批处理串行执行（exiftool 写入不可中断,暂停/取消在文件之间检查）。
> - **自动模式（Phase D）几乎全在渲染进程**：`autoModeStore`(会话态) + `useAutoErase`(导航触发) + `AutoModePrompt`/`AutoModeStrip`,复用既有 `metadata.erase`/`file.suggestExportPath`/`task.startEraseBatch`,无新增 IPC。安全取舍:自动应用**一律 export-new**,浏览触发不破坏原图。
> - **持久化相关全部顺延 M7**：Exif 摘要缓存、自动规则永久 scope（directory/global）+「存为默认规则」、任务历史(目前仅主进程内存,重启即清)——均待 settings.json / SQLite 基建。

---

## M5 — 保存到目标 + 批量重命名（PRD §6.7 / §6.8）

- [x] hash：MD5 / SHA1（`services/hash.ts`,`node:crypto` 流式 + path+mtime 缓存;**Worker Threads 离线化顺延 M7**,与缩略图/预览缓存一并做）
- [x] `file.saveToTarget(options)`：保持原名/MD5/SHA1/自定义模板/序号(序号即 `{nr:001}.{ext}` 模板)
- [x] 命名模板引擎（`packages/core/naming.ts`,纯函数 + 单测）：`{name}{ext}{md5}{sha1}{date}{time}{mtime}{width}{height}{index}{nr:001}` + `sanitizeFilename`
- [x] 冲突处理：跳过/覆盖/追加序号/MD5 比对(相同跳过,否则递增);**「弹窗询问」(交互式逐文件)顺延后续**——四种非交互策略已覆盖安全默认
- [x] `file.batchRename(options)`：替换删除字符（含正则/大小写/仅文件名）/ 指定位置删除(前 N/后 N/区间/标记前后) / 按序号编号
- [x] 重命名安全：预览表格 + 重名检测 + 非法字符检测 + 循环冲突(A→B,B→A)避免(执行期两阶段临时名 + 失败回滚) + dry-run(预览即 dry-run) + 日志(复制/导出);**撤销以重命名日志替代**(PRD §6.8「撤销，或生成日志」二选一)
- [x] 多图：保存焦点图(scope=image,直接 IPC);保存当前组/文件夹走 `task.startSaveBatch` + 批处理页(任务预览/进度)

**验收**（PRD §17.4）：✅ typecheck/test(111 core + 6 服务集成,已验证后移除)/lint/build 全绿；MD5/SHA1/自定义命名、批量重命名预览+冲突检测、失败不破坏原文件(save 只复制不动原图、rename 两阶段回滚)、多图当前组保存前有预览——均经临时集成测试覆盖(keep/md5/number/md5_compare + A↔B 交换 + 外部冲突回滚)。
> M5 范围说明 / 顺延项：
> - **分层**：命名模板(`naming.ts`)+ 重命名规划器(`rename.ts`,含 illegal/duplicate/collision 检测、A→B/B→A 环不视为冲突)纯逻辑在 `packages/core`(单测);`services/hash.ts`(流式哈希)、`services/save.ts`(复制+命名+冲突)、`services/rename.ts`(两阶段改名)做 fs 编排;`taskScheduler` 泛化为通用 `execute/spawn` Control,erase/save 共用一套生命周期。
> - **save 安全**：一律 `copyFile` 复制,绝不移动/覆盖原图,且拒绝写到源文件自身。
> - **顺延**：hash Worker Threads 离线化、冲突「弹窗询问」、撤销(以日志替代)→ 后续/M7。

---

## M6 — 格式转换（PRD §6.9）

- [x] convert（sharp）：输出 JPEG / PNG / WebP / AVIF / TIFF（sharp async 自带 libvips 线程池,**直接跑主进程**,Worker Threads 离线化顺延 M7)
- [x] 转换参数：JPEG(质量/渐进/保留Exif/ICC)、PNG(压缩/透明)、WebP(有损无损/质量)、AVIF(质量/速度/色深)
- [x] 转换流程 UI：选图(scope 图/组/夹)→格式→参数→输出位置(原地同目录/选文件夹)→预览→执行→结果(`ConvertDialog`)
- [x] 安全：默认不覆盖原文件(只写新文件,原地 jpg→jpg 强制改名);失败保留原文件;批量可取消(复用 scheduler);失败重试(复用)；**保留目录结构顺延**(队列为单层非递归夹,暂不涉及递归)
- [x] 转换后可打开目标文件夹（单图转换成功后 `showInFolder` 新文件）
- [x] 多图：焦点图转换(scope=image,直接 IPC) / 当前组·文件夹走 `task.startConvertBatch` 批处理页（带预览）
- [x] **spike**：✅ sharp 0.35.1 / libvips 8.18.3 在 Electron 42(ABI 146)**零 rebuild 加载**(N-API);**HEIC 读+写均支持**(libheif 内置);JPEG/PNG/WebP/AVIF/TIFF 全通(见 `spike/sharp` 分支 commit)

**验收**（PRD §17.5）：✅ typecheck/test(120 core + 4 服务集成,验证后移除)/lint/build 全绿；JPEG/PNG/WebP/AVIF/TIFF 转换可用;任务可取消/重试/有错误日志;默认不覆盖(只写新文件+原地强制改名,集成测试验证原图字节不变);可选保留 Exif/ICC;多图当前组可入队并预览。
> M6 范围说明 / 顺延项：
> - **分层**：格式列表/扩展名/输出名/默认参数/clamp 纯逻辑在 `packages/core/convert.ts`(单测);`services/convert.ts` 跑 sharp 管线(per-format 选项 + keepExif/keepIcc + alpha flatten + 冲突);`taskScheduler` 复用泛化 Control 加 `startConvertBatch`;`TaskType` 用既有 `'convert'`。
> - **原生模块**:`sharp` 在 `electron.vite.config.ts` 显式 external(同 exiftool-vendored,已验证主进程包未 inline);`pnpm-workspace.yaml` allowBuilds 加 `sharp`。生产打包 `asarUnpack` + Windows/Linux 预编译二进制验证留 **M7**。
> - **HEIC/JXL 输出**:spike 证实 HEIC 读写可行,但按 PRD 属增强档,MVP 输出格式仍限 JPEG/PNG/WebP/AVIF/TIFF;HEIC/JXL/PDF/ICO 输出顺延。
> - **保留目录结构**:当前队列是单层非递归文件夹,结构保留无实际场景,递归转换 + 结构保留顺延。
> - **动图**:仅转首帧(未开 `animated`),动图保留顺延。

---

## M7 — 缓存、性能优化与发布（PRD §6 缓存 / §14 / §18）

> **M7 是 MVP 收口里程碑**:把 M1–M6 一路顺延的「持久化 / 缓存 / 性能 / 打包」债务集中清掉。下面 A–E 五组任务即 M0–M6 各里程碑顺延项的汇总(每项标注来源里程碑);功能层面的增强项(交互式冲突、撤销、HEIC 输出、递归转换等)不属于 M7 核心,集中列在本节末的「MVP 后增强(非 M7)」。

### A. 缓存基建（SQLite + 磁盘缓存,PRD §6 缓存）

> 当前所有缓存都是**主进程内存**态,重启即清;M7 落地 `better-sqlite3`(主进程)+ 磁盘缓存目录,把这些入库。

- [x] 接入 `better-sqlite3`(主进程,WAL),作为缩略图/预览(后续 Exif/哈希)的统一元数据缓存层(`services/db.ts`;非 N-API,`postinstall` 走 `electron-rebuild` 对齐 Electron ABI,见 spike)
- [x] 缩略图缓存:sharp 生成 webp,key=`sha1(variant+spec+mtime+size+path)`,文件落 `userData/cache/thumb`,SQLite 索引(`services/thumbnail.ts` + `image-processing/variant.ts`,纯 key 逻辑含单测)
- [x] 预览图缓存:同上,2048px webp,落 `userData/cache/preview`;mtime/size 变化即换 key 失效
- [x] Exif 摘要缓存入库(**M3 顺延**完成;`services/metaCache.ts` 的 `exif` 表作 L2 持久层,内存 L1 之后,mtime 失效 + 行数 LRU;就地擦除 `dropExif` 失效)
- [x] 哈希(MD5/SHA1)缓存入库(**M5 顺延**完成;`hashes` 表 `(path,algo)` 主键,同样 L1+L2、mtime 失效;重开同夹再保存不重算)
- [x] 缓存大小上限管理 + 淘汰策略:per-variant 字节预算(512MB/1GB,**暂硬编码**)超额按 `accessed_ms` LRU 淘汰,每 128 次写入批量触发(settings 化的预算待 Phase D)

### B. 缩略图 / 预览管线（sharp 主进程异步;Worker 离线化按需）

- [x] `gv-img://` 的 `thumb` / `preview` variant 接 sharp(原返回 501;`protocol.ts` 流式回传缓存文件,生成失败回 415)
- [x] 队列栏显示缩略图(**M1 顺延**;`QueueRail` 改 lazy `<img src=gv-img://thumb>`,`loading="lazy"` 仅请求可视行,解码失败回退格式徽章)
- [x] 大队列**虚拟化**渲染(**M1 顺延**完成):`QueueRail` 固定行高(54px)窗口化,仅渲染可视区(+overscan)行,绝对定位于全高占位 div 上;`scrollIntoView` 改为手动滚动到选中项(选中行可能未挂载);只有屏上行请求缩略图
- [ ] hash / 缩略图 / 预览 / Exif 读取统一离线化到 Worker Threads(**M5/M6 顺延**;sharp async 已自带 libvips 线程池、主进程不阻塞,同 M6 取舍——仅在 profiling 显示主线程争用时再上 Worker)

### C. 性能与内存（PRD §14）

- [x] **非原生可解码格式接 `preview` 显示**(**M1 顺延**完成):HEIC/TIFF/JXL 等原来「无法预览」占位 → Canvas/MultiView 改用 `gv-img://preview`(sharp webp,Phase A 缓存)经新 `displaySrc()`,可解码格式仍走原图,SVG/ICO 保留原图(sharp 不栅格化);preview 也失败才回退占位
- [~] 图片预加载策略调优(**M1/M2 顺延**):单图前后已做(`Canvas` 保留 ≤2 个 `new Image()` warm Chromium 内存缓存,翻页秒开,内存有界);各多图模式「下一组」预加载待做
- [ ] 多图预览加载策略:只加载当前组原图 + 下一组**轻量预览**;50MP+ 优先格子尺寸预览(**M2 🔴 顺延**;grid 按尺寸择 preview 需先回填 `width/height`,见 group A 顺延的尺寸读取)
- [ ] 多图预览任务接入调度器:优先级 + 翻组时取消过期任务(**M2 顺延**)
- [x] 大图策略:**单图视图按用户偏好一律载入原图**(全质量,不做 preview 替换);仅浏览器无法解码的格式(HEIC/TIFF…)回退 sharp `preview`,经 `image.dimensions` IPC(sharp metadata 读头、含 EXIF 方向、不全解码,`services/imageInfo.ts` 缓存)拿真实尺寸喂 `setNatural`(状态栏尺寸正确)。**多图网格**:每格探测尺寸,**大图栅格(>2048px)用 preview** 限制同组并发解码内存,小图栅格 / svg/ico 用原图,非可解码格式用 preview;展开(Enter)进单图仍显示原图
- [ ] 多图模式内存优化收尾 + 长时浏览内存稳定性测试(1000 张连切不涨内存)

### D. 持久化设置（settings.json + `packages/config`,PRD §10.1）

> 落地 `settings.json` + 类型化 IPC 后,把现在散在 renderer/会话内存里的状态统一迁过去。

- [x] `settings.json` 落地 + 类型化 IPC(`services/settings.ts`:sync 读写 + 合并默认 + 原子写;`settings.get/update/reset` 单一来源通道 + preload);**`AppSettings`/`AppLanguage`/`QuickSaveRule` 类型移入 shared-types**(IPC 契约一部分),`@folio/config` 改为 re-export + 持有 `DEFAULT_SETTINGS`
- [x] 语言设置迁移(**M1 顺延**完成):启动时见旧 key `folio.settings.language` → 写入 settings 后删除;首启无文件时按 `app.getLocale()` 取系统语言
- [x] i18n 初始化顺序:`main.tsx` 先 `await settings.get()` 再 render(无语言闪烁);读取失败回退系统语言、不阻塞看图
- [x] 快速保存规则持久化(**M5 顺延**完成;`saveStore.setQuickRule` → `settings.update`,boot 时 hydrate)
- [x] 缓存大小预算接 settings(`thumbnail/previewCacheSizeMB` 驱动 Phase A 的 LRU 预算,去掉硬编码)
- [x] 「存为默认规则」(**M4 顺延**完成):擦除对话框记住上次 preset/分类/自定义标签 → `settings.defaultErase`,下次开框预填;boot 时 hydrate。**全局自动应用 scope(directory_recursive/global)刻意不做**——会在每个浏览过的文件夹散落导出副本,UX 风险大;跨图应用仍走 session-directory 自动模式(已有)
- [x] 任务历史持久化(**M4 顺延**完成):`services/taskHistory.ts` 把终态任务存 SQLite(上限 200),`scheduler.init()` 启动加载、标 `restored`;`restored` 任务无运行期 Control 故 `canRetry` 返回 false(隐藏重试),仍可查看/导出日志;`clearFinished` 一并清历史
- [x] 设置页扩展(语言 + 浏览[循环/同步缩放] + 安全[删除确认] + 缓存[缩略图/预览 MB]);**排序/多图模式/循环/同步缩放从各自既有控件自动记忆**(setSortMode/setMode/toggleLoop/toggleSync 现持久化),无需额外 UI。**快捷键自定义 UI 仍未做**(键位目前固定,见 §7;非 MVP 阻塞项)

### E. 打包与发布（PRD §18 / §19.5）

- [x] electron-builder 配置(`apps/desktop/electron-builder.yml`)+ 脚本(`pack:dir` / `dist` / `dist:mac` / `dist:win`);output=`release/`、buildResources=`resources/`(因 `build/` 已 gitignore)
- [x] 原生模块 `asarUnpack`:exiftool-vendored(**M3 顺延**)+ sharp/@img(**M6 顺延**)+ better-sqlite3(**M7**)— `npmRebuild:false`(已由 postinstall electron-rebuild / N-API prebuild 处理,免二次重建)
- [x] **macOS arm64 DMG 已验证产出可启动**:`Folio-0.0.0-arm64.dmg`(119–131MB);三个原生模块二进制都正确落到 `app.asar.unpacked`,`codesign --verify --deep --strict` 通过,实机启动写出 `[start]` 日志
- [x] 崩溃日志:`services/logging.ts`——`crashReporter`(`uploadToServer:false`,转储留本机)+ `uncaughtException`/`unhandledRejection`/`render-process-gone`/`child-process-gone` 写 `userData/logs/main.log`;设置页「诊断」段「打开日志文件夹」(IPC `system:openLogs`)
- [ ] **未签名(暂不接 Developer ID / 公证)**:`mac.identity:null` 跳过签名,故 `afterPack` 钩子(`scripts/afterPack.cjs`)对 bundle 做 **ad-hoc 签名**——否则 Apple Silicon 因 framework 原签名被破坏而拒绝启动(实测「damaged」)。拿到证书后换成真实签名 + notarize 即可(entitlements 已备 `resources/entitlements.mac.plist`)
- [ ] Windows / Linux 产物 + sharp 跨平台预编译二进制验证(**M6 顺延**):pnpm 10+ 不装其它平台的 `@img/sharp-*`,需在目标平台构建或补 optionalDependencies;Windows NSIS / Linux AppImage 配置已就位但未实跑
- [x] 应用图标:`resources/icons/icon.icns`(mac)/ `icon.ico`(win) 已就位并在 `electron-builder.yml` 引用(v0.2.3 重塑为圆角 squircle + 留白 + 投影)

**验收**（PRD §17 全量 + §19.5 发布清单）：三平台可装可启；1000 张不阻塞；四宫格连切不涨内存；擦除默认导出新文件；批处理有预览/确认/日志；不上传图片、不扫未选目录。

---

## MVP 后增强（非 M7 核心，按需排期）

> 以下是 M1–M6 中明确标为「增强 / 后续」而非「顺延 M7」的功能项。它们不阻塞 MVP 发布,集中登记以免遗漏;M7 完成后视优先级再排。

- **交互式冲突「弹窗询问」**(**M5**):保存/转换冲突时逐文件询问(现已有 skip/overwrite/number/md5_compare 四种非交互策略覆盖安全默认)
- **重命名撤销**(**M5**):现以「重命名日志(复制/导出)」替代(PRD §6.8 撤销与日志二选一,已选日志)
- **格式转换增强**(**M6**):HEIC/JXL/PDF/ICO 输出(spike 证实 HEIC 读写可行,MVP 不输出)、递归转换 + 保留目录结构(现队列单层非递归)、动图保留(现仅转首帧)
- **多图增强**(**M2**):同步平移、按中心/主体对齐、锁定比例、格内 pan;状态栏组内失败汇总;当前组批量操作快捷入口
- **Exif keep-list 字段级编辑器**(**M4**):`remove_all_except_keep` 现仅经 分享/完全 预设暴露,缺自由编辑保留字段的 UI
- **扫描期读取图片尺寸**(**M1**):队列元数据 `width/height` 现为 pending,状态栏尺寸取自 `<img>` 解码值;可在扫描/Exif 读取期回填

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
