# Folio

Folio 是一款跨平台桌面看图应用，基于 Electron、React、TypeScript 和 pnpm workspace 构建。

MVP 需求和架构说明见：

- `docs/prd.md`
- `docs/mvp-tasks.md`

## 开发

安装依赖：

```powershell
pnpm install --frozen-lockfile
```

启动桌面应用：

```powershell
pnpm dev
```

## Electron 安装说明

如果全新安装依赖后，运行 `pnpm dev` 报错：

```text
Error: Electron uninstall
```

说明 `electron` 这个 npm 包已经安装，但 Electron 运行时二进制没有下载完成。此时 `electron-vite` 可以正常构建 main 和 preload bundle，但启动应用时找不到 `electron.exe`。

缺失位置通常是：

```text
node_modules/.pnpm/electron@*/node_modules/electron/dist/
```

执行 Electron 自带的安装脚本：

```powershell
node node_modules\.pnpm\electron@42.4.1\node_modules\electron\install.js
```

然后重新启动应用：

```powershell
pnpm dev
```

当前 workspace 已在 `pnpm-workspace.yaml` 中允许必要的安装脚本：

```yaml
allowBuilds:
  electron: true
  esbuild: true
```

如果手动安装脚本出现 `TypeError: fetch failed` 等网络错误，检查网络或代理配置后重新运行同一条命令。

## 常用命令

```powershell
pnpm dev
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm format
```
