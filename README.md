# Folio

Folio 是一款专为「快速浏览成套相册」打造的跨平台桌面看图应用。项目采用 Electron + React + TypeScript 技术栈构建，由 Vibe Coding 驱动。

![Multiview](images/preview.webp)

MVP 需求和架构说明见：

- `docs/prd.md`
- `docs/mvp-tasks.md`

已实现功能见：  

[features.md](docs/features.md)

## 开发

安装依赖：

```bash
pnpm install --frozen-lockfile
```

启动桌面应用：

```bash
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

## 常用命令

```powershell
pnpm dev
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm format
```

## License

本项目采用 GPL-3.0 许可证开放源代码。了解更多内容，请查看 [LICENSE 文件](LICENSE.txt)。
