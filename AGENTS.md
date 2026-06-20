# Folio — Agent 指南

> 通用项目说明,适用于任意 AI 编码助手(Claude Code / codex / 等)。
> Claude Code 专属内容见 `CLAUDE.md`(已 `@` 引用本文件)。

## 项目是什么

跨平台看图 APP:轻量、快速、可靠的图片浏览 + 内置 Exif 查看/隐私擦除、批量重命名、格式转换、**多图并列浏览**(差异化核心)。

- 完整需求 + 技术决策:**`docs/prd.md`**(开发前最终文档,v1.0)
- MVP 任务清单 / 里程碑:**`docs/mvp-tasks.md`**
- UI 原型:**`.dev/design/GalleryViewer.dc.html`**(见下方「设计系统」)

**当前状态**:**M0–M5 已落地**(M0 脚手架 · M1 基础看图 · M2 多图并列 · M3 Exif 查看 · M4 Exif 擦除/批处理/自动模式 · M5 保存到目标 + 批量重命名)。**下一步 M6**(格式转换)。各里程碑范围/顺延说明见 `docs/mvp-tasks.md`;**持久化相关(SQLite 缓存、settings.json、自动规则永久 scope、语言设置迁移)统一顺延 M7**。已落地的跨文件约定见下方「已落地架构」。

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
folio/
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

## 已落地架构(读多文件才看得出的约定,新接手先记这些)

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
- **快速保存**:`saveStore.quickRule`(会话内存,首次保存时由对话框记录 `{targetDir, naming, conflict}`)+ `actions.quickSaveCurrent`(`T` 键/工具栏快速按钮:一键存焦点图,首次无规则则打开对话框询问)。右键菜单「保存到文件夹…」始终打开完整对话框。规则持久化到 settings.json 顺延 M7。
- **新增 IPC(均单一来源于 `shared-types`)**:`file:chooseDirectory`(目标夹选择)、`file:saveToTarget`、`file:batchRename`、`file:saveText`(导出日志)、`task:startSaveBatch`。对话框组件 `SaveDialog`/`RenameDialog` 复用 `DialogPrimitives`(`ScopeButton`/`RadioRow`/`Field`),入口在工具栏 + 右键菜单。

### electron-vite 配置坑(`electron.vite.config.ts`)
- `electron` 是 devDependency,需在 main/preload 的 `rollupOptions.external` 里**显式 external**,否则会打包 npm 启动桩、触发二进制下载。
- **`exiftool-vendored` 同样必须显式 external**(`externalizeDepsPlugin({include})` + `rollupOptions.external`),否则其源码被 inline、vendored 二进制按模块路径定位失效(主进程包体会从 ~17kB 暴涨)。新增 sharp/better-sqlite3 等原生模块照此处理。
- preload 输出强制为 **`.cjs`**(`format: 'cjs'`)——根 `"type": "module"` 下 sandbox preload 必须是 CommonJS;`index.ts` 里 preload 路径也写的是 `../preload/index.cjs`。
- renderer 有 alias `@renderer` → `src/renderer/src`。
- typecheck 分两份:`tsconfig.node.json`(main/preload)+ `tsconfig.web.json`(renderer);`pnpm typecheck` 跑全包,`@folio/desktop` 的 `typecheck` 会两份都跑。

## 常用命令

```bash
pnpm install        # 安装依赖
pnpm dev            # 启动 Electron(三进程 HMR)
pnpm typecheck      # 全包类型检查
pnpm test           # Vitest 单测(主要覆盖 packages/core)
pnpm lint           # Biome 检查
pnpm format         # Biome 格式化
pnpm build          # electron-vite 构建(打包用 electron-builder,M7)
```

> **原生构建脚本审批(pnpm 11)**:Electron 的 postinstall 会下载运行时二进制,esbuild 也需构建。两者已在 `pnpm-workspace.yaml` 的 `allowBuilds` 中批准。若 fresh install 后 `pnpm dev` 报 `Error: Electron uninstall`(二进制未下载),执行:
> ```bash
> node node_modules/.pnpm/electron@*/node_modules/electron/install.js
> ```
> 后续新增有 build script 的依赖(如 sharp / better-sqlite3),需在 `allowBuilds` 中加一行并重装。

## 代码约定

- TypeScript 全程;IPC 契约类型集中放 `packages/shared-types`,main/preload/renderer 共享同一份。
- IPC 按命名空间分组:`image.*` / `queue.*` / `multiView.*` / `metadata.*` / `file.*` / `task.*`(见 prd §9.2)。
- Electron 安全基线:`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`;preload 仅用 `contextBridge`。
- 渲染进程状态按 slice 拆:`queueStore` / `multiViewStore` / `viewerStore` / `settingsStore`。
- 写代码前对齐周边风格(命名、注释密度、目录习惯);纯逻辑优先放 `packages/core` 并补单测。
- 跨平台 UI 文案不要写死 macOS 术语。涉及系统文件管理器/删除位置时按平台区分:macOS 用「访达 / 废纸篓」(Finder / Trash),Windows 用「资源管理器 / 回收站」(File Explorer / Recycle Bin),其他平台用通用「文件夹 / Trash」;相关文案统一走 i18n 与平台 helper。

## 提交规范

- 提交信息使用 Conventional Commits: `<type>: <summary>`。
- 常用类型:`feat`(新功能)、`fix`(缺陷修复)、`docs`(文档)、`refactor`(重构)、`test`(测试)、`chore`(工程杂项)。
- 修复类提交必须使用 `fix:` 前缀,例如 `fix: handle Windows image protocol paths`。
- summary 使用英文祈使句或简短动词短语,不加句号;一次提交只描述一个清晰变更。

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
