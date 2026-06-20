# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

通用项目说明(项目概述、技术栈、架构铁律、仓库结构、命令、约定、设计系统、安全要求)见:

@AGENTS.md

> ⚠️ AGENTS.md 写于建仓初期,「当前状态:M0 之前,仓库尚无代码」一句已过时。**实际进度:M0–M5 已落地**(M0 脚手架 · M1 基础看图 · M2 多图并列 · M3 Exif 查看 · M4 Exif 擦除/批处理/自动模式 · M5 保存到目标 + 批量重命名)。**下一步 M6**(格式转换)。各里程碑的范围/顺延说明见 `docs/mvp-tasks.md`;**持久化相关(SQLite 缓存、settings.json、自动规则永久 scope、语言设置迁移)统一顺延 M7**。

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
- **绝大多数通道是 invoke(请求/响应)**;main→renderer **推送**目前有两个:`task:update`(批处理进度,scheduler 每次 mutation 推全量任务快照,preload 暴露成 `task.onUpdate(cb)`)与 `win:fullscreenChanged`(进出全屏,preload 暴露成 `win.onFullscreenChanged(cb)`,驱动沉浸式全屏布局)。两者都走 `ipcRenderer.on` + 返回退订函数的模式。要再加推送通道照此模式,别用 invoke 轮询。

### 图片加载走 `gv-img://`,不走 IPC
- URL 形状:`gv-img://<variant>/<absolute-path>`,**variant 是 host**(`original` | `thumb` | `preview`)。当前仅 `original` 实现(流式 `createReadStream`),`thumb`/`preview` 返回 501,待 M7 接 sharp。
- scheme 在 `protocol.ts` 用 `registerSchemesAsPrivileged` 声明,**必须在 app `ready` 之前调用**(`index.ts` 顶层已调)。
- Windows 路径修正:`/C:/…` 开头会去掉前导斜杠(见 `protocol.ts`,对应 commit `263c698`)。
- 渲染进程零 fs 访问;拖拽文件拿绝对路径用 preload 的 `webUtils.getPathForFile`(Electron 已移除 `File.path`)。

### 扫描与队列
- `services/scan.ts` 的 `buildScanResult(paths)` 统一入口:单目录→扫该目录;单图片→扫其所在文件夹并把该图设为 `currentIndex`;多路径→只收其中受支持的图片。**扫描非递归**,并发受 `mapLimit` 限流。
- **扩展名只用于「枚举/筛选」,真实格式靠 magic bytes**:目录枚举用 `isSupportedImage`/`extOf`(`@folio/image-processing` 的 `SUPPORTED_EXTENSIONS` 是唯一来源)挑出候选;每个入队图片再经 `services/format.ts` 的 `detectFileFormat` 只读文件头(`MAGIC_BYTES_LENGTH` 字节)嗅探真实格式,写入 `ImageQueueItem.format`。纯检测逻辑 `detectImageFormat`/`mimeTypeForFormat` 在 `@folio/image-processing`(纯函数 + 单测),fs 读取留在主进程 service。
- 渲染进程的 `lib/format.ts`(`canRenderNatively`/`formatLabel`)**优先用 `item.format`,无则回退 `ext`**;`gv-img://` 协议也用 `detectFileFormat` 设置正确的 `Content-Type`。扩展名说谎的图片(如 `.png` 实为 JPEG)因此能正确判定与显示。
- 队列 / viewer 状态在 `renderer/src/stores`(`queueStore` / `viewerStore` / `toastStore`),纯排序/分组逻辑在 `packages/core`(`sortItems`、`nextGroupStart` 等,带 Vitest)。`queueStore.version` 每次 mutation 自增,供后续 worker 丢弃过期结果(PRD §9.3)。
- **文件夹导航(刷新 / 浏览 / 载入下一夹)全部复用既有扫描入口,只新增一个 IPC**:`file:listDirectory(dir)` → `services/scan.ts` 的 `listDirectory`,返回 `DirListing`(子目录列表 + parent + 每个子目录的 `imageCount`/`subdirCount`)。**这里的计数是「只看扩展名」的廉价 readdir(`countChildren`),刻意不嗅探 magic bytes**——给浏览面板做提示/挑「下一个有图的同级夹」足够,别为它加重检测。刷新与载入文件夹都直接调 `image.openPaths([dir])`(无新通道)。
- 渲染端 `folderStore` 持有浏览态(`browsePath`/`listing`),**与已载入队列解耦**:打开浏览面板默认定位到当前文件夹的 parent(故同级夹直接可见);`offerNextFolder` 在末图按「下一张」时算出下一个含图同级夹并弹 `FolderPrompt`。刷新走 `lib/actions.ts` 的 `refreshQueue` → `queueStore.loadResult(result, { keepFocus: true })`(按 filePath 保持停留在当前图);`advance()` 统一「下一张/到尾则提示下一夹」,接在 `→`/`D` 上。`fs.ts`(`DirEntry`/`DirListing`)是这套类型的单一来源。

### Exif 查看 / 擦除 / 任务系统(M3–M4,核心是「纯逻辑在 core,fs/exiftool 编排在 main」)
- **读取(M3)**:`services/exiftool.ts` 薄封装 exiftool-vendored 的 `readRaw(file,{readArgs:['-G0']})`(family-0 分组),值预先字符串化;纯转换(`buildExifGroups`/`summarizeExif`/`filterExifGroups`/`exifToJsonString`)在 `packages/core/exif.ts`。主进程内存 LRU(path+mtime 失效)代替 SQLite,后者顺延 M7。
- **擦除(M4)**:规则/预设/校验/差异预览/验证全是纯函数,在 `packages/core/erase.ts`(`presetRule`/`partitionExifByRule`/`verifyRemoval`/`buildRemoveArgs`,单一来源 `ERASE_CATEGORIES`+`CATEGORY_PRESETS`);`services/exiftool.ts` 的 `eraseMetadata` 做 fs 编排(export=copyFile→strip→verify,在 place 直接 strip)。`remove_selected` 走 `write(…,{writeArgs:['-tag=',…]})` 且**对每个具体 tag 追加 `-IFD1:tag=`**(否则缩略图 IFD 残留副本);keep 模式走 `deleteAllTags({retain})`。
- **验证踩坑**:`File`/`Composite`/`ExifTool` 三个 family-0 组是文件系统/派生/版本伪标签,exiftool **永远删不掉**——`isRemovableGroup` 把它们排除在预览与验证之外,否则 keep 模式会误报「未擦除」而整批失败。
- **安全铁律(§13)**:默认导出新文件、绝不覆盖原图、失败绝不动/删原文件;就地覆盖需二次确认,批量就地覆盖再加一次 arm。
- **任务系统(M4 Phase C)**:纯状态机(合法迁移表/计数/派生)在 `packages/core/task.ts`;`services/taskScheduler.ts` 是单例,**串行**跑批处理(exiftool 写入不可中断,暂停/取消在文件之间检查),失败项可 retry。渲染端 `taskStore` 经 `task:update` 推送镜像,批处理页是 `AppViewMode` 的 `batch_tasks` 视图。
- **自动模式(M4 Phase D)几乎全在渲染进程**:`autoModeStore`(会话态,内存) + `useAutoErase`(导航触发) + `AutoModePrompt`/`AutoModeStrip`,复用既有 `metadata.erase`/`file.suggestExportPath`/`task.startEraseBatch`,**无新增 IPC**。安全取舍:自动应用**一律 export-new**,浏览触发不破坏原图;永久 scope/「存为默认规则」顺延 M7。

### 保存到目标 / 批量重命名(M5,纯逻辑在 core,fs 编排在 main,批处理复用泛化后的 scheduler)
- **命名模板**:纯函数 `packages/core/naming.ts`(`formatName` 支持 `{name}{ext}{md5}{sha1}{date}{time}{mtime}{width}{height}{index}{nr:001}`;`tokensIn`/`templateNeedsHash` 让 main **按需哈希**;`sanitizeFilename`/`isValidFilename` 用 code-point 判非法字符,**空格/连字符合法**,别用含 `\` 的正则字面量去 Edit——转义易踩坑)。
- **重命名规划器**:纯函数 `packages/core/rename.ts`(`applyRename` 三模式:replace/delete/sequence;`planRename` 产出预览=dry-run,逐项标 `illegal`/`duplicate`/`collision`;**A→B/B→A 环刻意不标冲突**,交执行期处理)。渲染端预览表实时跑 `planRename`,有阻塞项即禁用执行。
- **哈希**:`services/hash.ts` 流式 `createHash`+`createReadStream`,path+mtime+algo 有界缓存;**Worker Threads 离线化顺延 M7**(同缩略图/预览)。
- **保存**:`services/save.ts` 的 `saveFile` 据命名构造名→`sanitizeFilename`→在 targetDir 按 `ConflictPolicy`(skip/overwrite/number/md5_compare)解析路径→**一律 `copyFile`(复制不移动,拒写源文件自身),绝不动原图**。冲突递增复用 `paths.ts` 的 `suggestExportPath(target, '')`。「弹窗询问」策略顺延。
- **重命名执行**:`services/rename.ts` 的 `renameInDirectory` **两阶段**:源→唯一临时名(`.folio-rename-<i>.tmp`)→目标名,任一步失败回滚已完成项;**外部已存在文件的目标会被拒绝并回滚**(防 clobber),保证「失败不破坏未处理文件」。批量重命名**不走 scheduler**(快、原子性),是对话框 + 单 IPC + 结果日志(复制/导出 `file:saveText`)。
- **scheduler 泛化**:`services/taskScheduler.ts` 的 `Control` 改为通用 `{ type; files; execute(filePath); spawn(files) }`;`startEraseBatch`/`startSaveBatch` 各自构造 execute+spawn 调用共享 `launch`/`run`/`retry`。**save 批量(组/夹)走 `task:startSaveBatch` 上批处理页**;单图 save 走 `file:saveToTarget` 直接返回。`TaskType` 新增 `'save'`。
- **新增 IPC(均单一来源于 `shared-types`)**:`file:chooseDirectory`(目标夹选择)、`file:saveToTarget`、`file:batchRename`、`file:saveText`(导出日志)、`task:startSaveBatch`。对话框组件 `SaveDialog`/`RenameDialog` 复用 `DialogPrimitives`(`ScopeButton`/`RadioRow`/`Field`),入口在工具栏 + 右键菜单。

### electron-vite 配置坑(`electron.vite.config.ts`)
- `electron` 是 devDependency,需在 main/preload 的 `rollupOptions.external` 里**显式 external**,否则会打包 npm 启动桩、触发二进制下载。
- **`exiftool-vendored` 同样必须显式 external**(`externalizeDepsPlugin({include})` + `rollupOptions.external`),否则其源码被 inline、vendored 二进制按模块路径定位失效(主进程包体会从 ~17kB 暴涨)。新增 sharp/better-sqlite3 等原生模块照此处理。
- preload 输出强制为 **`.cjs`**(`format: 'cjs'`)——根 `"type": "module"` 下 sandbox preload 必须是 CommonJS;`index.ts` 里 preload 路径也写的是 `../preload/index.cjs`。
- renderer 有 alias `@renderer` → `src/renderer/src`。
- typecheck 分两份:`tsconfig.node.json`(main/preload)+ `tsconfig.web.json`(renderer);`pnpm typecheck` 跑全包,`@folio/desktop` 的 `typecheck` 会两份都跑。
