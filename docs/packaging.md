# 打包与发布说明

> Folio 用 **electron-builder** 打包(M7 Phase E)。当前为 **未签名构建**(macOS arm64 DMG 已验证可启动);Developer ID 签名 / 公证、Windows/Linux 产物、应用图标待补。
>
> 配置:`apps/desktop/electron-builder.yml` · 钩子:`apps/desktop/scripts/afterPack.cjs` · 产物目录:`apps/desktop/release/`(已 gitignore)。

## 快速开始

```bash
# 当前平台,产 .app(不打 DMG,最快,验证用)
pnpm pack:dir

# 当前平台全量产物(macOS = DMG + zip)
pnpm dist

# 指定平台(需在对应平台或具备其交叉构建条件)
pnpm dist:mac      # DMG + zip
pnpm dist:win      # NSIS 安装包
```

产物落在 `apps/desktop/release/`:

- `Folio-<version>-arm64.dmg`(+ `.blockmap`)
- `mac-arm64/Folio.app`(未压缩的 app,`pack:dir` 也产这个)

> **务必通过 `pnpm` 调用** electron-builder(脚本里已是)。直接跑 `./node_modules/.bin/electron-builder` 会让它 fallback 到 npm 检测,刷一大串 `duplicate dependency` 噪声(产物仍只含 production 依赖,但很吵)。如需手动加参数:`pnpm --filter @folio/desktop exec electron-builder --mac dmg`。

## 安装与首次启动(未签名)

未签名 + 未公证,所以 Gatekeeper 会拦一道:

- **macOS**:首次打开右键(Control 点按)`Folio.app` → 「打开」→ 确认;或清除隔离属性:
  ```bash
  xattr -cr /Applications/Folio.app
  ```
- **Windows**:SmartScreen 会提示「Windows 已保护你的电脑」→ 「更多信息」→ 「仍要运行」。

签名 + 公证接上后这些提示即消失(见下「接入签名」)。

## 它是怎么打的

### 只有 3 个原生模块需要随包

主进程 bundle(electron-vite)把 `@folio/*` 工作区包**全部 inline**,只把 `electron` + `sharp` + `exiftool-vendored` + `better-sqlite3` 标为 external;react / zustand 进 renderer bundle。所以运行时真正需要 `node_modules` 的只有这三个原生模块。

`electron-builder.yml` 的 `asarUnpack` 因此只列它们(它们要 `dlopen` `.node` / spawn ExifTool,**不能留在 asar 内**):

```yaml
asarUnpack:
  - '**/*.node'
  - '**/node_modules/sharp/**'
  - '**/node_modules/@img/**'                 # 预编译 libvips
  - '**/node_modules/better-sqlite3/**'
  - '**/node_modules/exiftool-vendored/**'
  - '**/node_modules/exiftool-vendored.*/**'  # 含 .pl(vendored ExifTool 本体)
```

验证(`pack:dir` 后):

```bash
find apps/desktop/release/mac-arm64/Folio.app/Contents/Resources/app.asar.unpacked -name '*.node'
# 应见 sharp-darwin-arm64-*.node 与 better_sqlite3.node
```

### 不在打包阶段重建原生模块

`electron-builder.yml` 设 `npmRebuild: false`。原因:

- `better-sqlite3` 已由 `apps/desktop` 的 `postinstall: electron-rebuild -w better-sqlite3` 按 Electron ABI(42 → ABI 146)编好;
- `sharp` 是 N-API prebuild,Electron 下零 rebuild。

在 pnpm 符号链接的 store 上让 electron-builder 再 rebuild 一次既冗余又易碎,故关掉。新增原生模块时若它需要按目标平台现编,再针对性开启。

### 目录约定

```yaml
directories:
  buildResources: resources   # 提交进 git 的资源(entitlements、图标)
  output: release             # 产物输出(gitignore)
```

`build/` 在本仓库是 gitignore 的构建产物目录,**不能**用作 electron-builder 默认的 `buildResources`,所以改成 `resources/`。

## macOS 未签名的启动坑(重要)

`mac.identity: null` 让 electron-builder **跳过签名**。但把我们的 app 塞进 Electron 预签名 framework 会**破坏原有签名**——Apple Silicon 内核拒绝启动签名损坏的 bundle,表现为「Folio 已损坏」/ 卡住、`app.whenReady()` 永不触发、连日志都没有。

解法:`scripts/afterPack.cjs` 在装配后对整 bundle 做 **ad-hoc 签名**:

```js
codesign --force --deep --sign - <Folio.app>
```

之后 `codesign --verify --deep --strict Folio.app` 通过,实机可启动。这是「未签名也能在本机跑」的最小手段,**不等于** Developer ID 签名(其他机器的 Gatekeeper 仍会拦)。

```bash
codesign --verify --deep --strict apps/desktop/release/mac-arm64/Folio.app && echo OK
```

## 跨平台二进制

pnpm 10+ **不自动安装其它平台**的 `@img/sharp-*`。单平台机器只有本平台的 libvips 二进制,所以:

- electron-builder 会 warn 一串「platform-specific optional dependencies not bundled」——只要**本平台**的项不在列表里就正常(如 darwin-arm64 机器上 `@img/sharp-darwin-arm64` 不会出现在缺失列表中)。
- 要产 Windows / Linux 包,需在对应平台构建,或把目标平台的 `@img/sharp-*` 显式装入(如加进 `optionalDependencies` 后在该平台 install)。

## 接入签名(拿到证书后)

`resources/entitlements.mac.plist` 已备好(hardened runtime 所需的 JIT 等 entitlement,当前 `hardenedRuntime: false`)。拿到 Developer ID 后:

1. 删除/改写 `scripts/afterPack.cjs`(不再需要 ad-hoc),或让它仅在无证书时兜底。
2. `electron-builder.yml`:
   ```yaml
   mac:
     identity: "Developer ID Application: <NAME> (<TEAMID>)"
     hardenedRuntime: true
     notarize: true            # 或用 afterSign 钩子 + @electron/notarize
   ```
3. 证书与公证凭据通过环境变量提供(`CSC_LINK` / `CSC_KEY_PASSWORD`,公证 `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`)——**绝不写进仓库**。
4. Windows Authenticode:`win.signtoolOptions` + 证书(同样走环境变量)。

## 崩溃日志

打包产物内置离线诊断(`apps/desktop/src/main/services/logging.ts`):

- **原生崩溃**:`crashReporter`(`uploadToServer:false`)转储留本机 Crashpad 目录;
- **JS 异常**:`uncaughtException` / `unhandledRejection` / `render-process-gone` / `child-process-gone` 追加写 `userData/logs/main.log`(写盘失败静默吞掉,绝不拖垮进程);
- **入口**:IPC `system:openLogs` → 设置页「诊断」段「打开日志文件夹」。

全部**离线**,绝不上传(PRD §13)。日志位置:

- macOS:`~/Library/Application Support/Folio/logs/main.log`
- Windows:`%APPDATA%/Folio/logs/main.log`

## 待办

- [ ] macOS Developer ID 签名 + 公证
- [ ] Windows NSIS 实跑 + Authenticode 签名
- [ ] Linux AppImage 实跑
- [ ] 应用图标:`resources/icon.icns`(mac)/ `resources/icon.ico`(win)
- [ ] CI 三平台构建流水线
