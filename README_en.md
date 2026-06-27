# Folio

English | [简体中文](README.md)

Folio is a lightweight cross-platform desktop image viewer built for fast folder browsing, side-by-side comparison, and privacy-safe image workflows.

It is built with Electron, React, and TypeScript, and developed as an open-source GPL-3.0 project.

Folio can preview up to 4 images at once:

![Multiview](images/preview.webp)

Implemented features are tracked in [features.md](docs/en/features.md).

## Highlights

- Fast folder browsing with a queued image list and cached thumbnails.
- Single-image viewing with fit, zoom, rotation, drag panning, and file drag-out.
- 2 / 3 / 4-up multi-view for comparing image sets.
- Exif / XMP / IPTC / GPS metadata viewer with summary, grouped, and raw JSON views.
- Privacy-safe metadata removal with presets, previews, verification, and batch tasks.
- Batch rename with dry-run previews and conflict checks.
- Save-to-target and quick-save workflows with naming templates.
- Format conversion to JPEG, PNG, WebP, AVIF, and TIFF.
- Local-first diagnostics and crash logs. Images and metadata are not uploaded.

## Supported Image Formats

| Format | Viewing | Notes |
|---|---|---|
| JPEG, PNG, WebP, GIF, BMP, AVIF | Supported on all platforms | Native display |
| TIFF | Supported on all platforms | Displayed through generated previews |
| SVG | Supported on all platforms | Vector rendering |
| ICO | Supported on all platforms | Display only, not a conversion input |
| HEIC, HEIF | macOS supported / Windows and Linux unsupported | macOS uses system ImageIO fallback |
| JPEG XL (`.jxl`) | macOS supported / Windows and Linux unsupported | macOS uses system ImageIO fallback |

> HEIC, HEIF, and JPEG XL are not currently supported for viewing on Windows or Linux. The current Chromium / libvips runtime does not include decoders for those formats; macOS support is provided through system components.

## Development

Install dependencies:

```bash
pnpm install --frozen-lockfile

cd apps/desktop

npx install-electron
```

Start the desktop app:

```bash
pnpm dev
```

## Electron Install Note

If a fresh dependency install is followed by this error when running `pnpm dev`:

```text
Error: Electron uninstall
```

This is because Electron 42 [no longer downloads itself](https://www.electronjs.org/blog/electron-42-0#electron-no-longer-downloads-itself-via-postinstall-script) via the `postinstall` script.

You need to manually execute:
```bash
npx install-electron
```

The Electron dependency for this application is located in `apps/desktop/package.json`, so you need to execute:

```bash
cd apps/desktop
npx install-electron
```

Then start the app again:

```bash
pnpm dev
```

The workspace already allows the required install scripts in `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  electron: true
  esbuild: true
```

## Common Commands

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm format
```

## Packaging

```bash
cd apps/desktop

# macOS package
pnpm dist:mac

# Windows package
pnpm dist:win
```

## License

Folio is open source under the GPL-3.0 license. See [LICENSE.txt](LICENSE.txt).

## Acknowledgements

Folio is built on top of excellent open-source projects:

- [Electron](https://www.electronjs.org/) - cross-platform desktop framework
- [React](https://react.dev/) - UI framework
- [TypeScript](https://www.typescriptlang.org/) - type system
- [Zustand](https://github.com/pmndrs/zustand) - renderer state management
- [Tailwind CSS](https://tailwindcss.com/) - styling
- [sharp](https://sharp.pixelplumbing.com/) / [libvips](https://www.libvips.org/) - image decoding, thumbnails, and conversion
- [ExifTool](https://exiftool.org/) / [exiftool-vendored](https://github.com/photostructure/exiftool-vendored.js) - metadata reading and removal
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) / [SQLite](https://www.sqlite.org/) - local cache index
- [Vite](https://vite.dev/), [electron-vite](https://electron-vite.org/), and [electron-builder](https://www.electron.build/) - build and packaging
- [Biome](https://biomejs.dev/) - linting and formatting
- [Lucide](https://lucide.dev/) - icon design reference
