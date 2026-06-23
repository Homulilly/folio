# Folio Implemented Features

> This page briefly lists the features currently implemented in the codebase. For the full product requirements, see [`../prd.md`](../prd.md). For milestone status, see [`../mvp-tasks.md`](../mvp-tasks.md).

## Opening And Browsing

- Open images, open folders, or drag images/folders into the window.
- Opening one image loads its containing folder and focuses that image.
- Folder scanning is non-recursive; dragging multiple paths loads only supported images.
- The left queue shows thumbnails, file names, and file sizes, with current-item highlighting, click navigation, and collapse/expand support.
- The queue supports refresh, sorting, folder browsing, and recent folder history.
- At the end of a folder, Folio can prompt to load the next sibling folder that contains images.

## Single Image Viewing

- Fit to window, original size, zoom in/out, mouse-wheel zoom, and drag panning.
- Double-click to return to fit, rotate, reset orientation, and use floating previous/next arrows.
- Drag the real image file out from the viewer to the system file manager or upload controls.
- Custom scrollbars overlay the image without changing the canvas layout.

## Multi-View

- Single, 2-up, 3-up, and 4-up viewing modes.
- Layout variants such as horizontal/vertical 2-up, alternate 3-up layouts, and 2x2 4-up.
- Group navigation, loop browsing, and mouse-wheel group switching in the grid.
- Focus slot selection, temporary focus-image expansion, and returning to the grid.
- Synchronized zoom; when disabled, each slot keeps its own zoom state.
- The status bar shows the current mode, group range, focused image details, and sync-zoom state.

## Formats And Display

- Detects real image formats from file headers instead of trusting extensions.
- Covers display or detection strategies for JPEG, PNG, GIF, WebP, BMP, TIFF, AVIF, SVG, ICO, HEIC/HEIF, and JPEG XL.
- Formats Chromium can decode are shown directly; formats such as TIFF use generated previews.
- macOS can preview HEIC, HEIF, and JPEG XL through system support; Windows/Linux preview support for those formats is not available yet.
- Load failures distinguish missing files, permission problems, and decode failures.

## Exif Viewer

- A right-side Exif drawer shows metadata for the focused image.
- Summary, grouped, and raw JSON views.
- The summary includes camera, lens, exposure, description, author, copyright, GPS, and other key fields.
- GPS is shown as a “contains GPS information” indicator in the summary instead of exposing coordinates directly.
- Search fields, copy a single field, or copy everything as JSON.
- Exif is read only when the drawer or erase dialog is opened, not during scanning or thumbnail generation.

## Exif Removal And Privacy Cleanup

- Remove metadata from the current image, current group, or whole folder.
- Privacy, sharing, full cleanup, keep copyright, and custom presets.
- Select metadata categories to remove, or enter custom tags.
- Preview differences before removal, then reread and verify the result.
- Exports a new file by default and does not overwrite originals; in-place overwrite requires extra confirmation.
- Session auto mode can export cleaned copies automatically while browsing the same folder.

## Batch Tasks

- Batch erase, batch save, and batch convert run through the task page.
- The task page shows progress, current file, completed count, failed count, and error logs.
- Pause, resume, cancel, retry failed items, copy logs, and export logs.
- Finished tasks are saved as history and remain visible after restart.

## Save And Quick Save

- Copy the current image, current group, or whole folder to a target folder.
- Naming modes include original name, MD5, SHA1, sequence number, and custom templates.
- Conflict policies include append number, skip, overwrite, and skip when MD5 matches.
- Save operations copy files only; they do not move or modify originals.
- Quick Save can be triggered from the toolbar or `T`, and supports multiple remembered target folders.

## Batch Rename

- Batch rename images in the current folder.
- Replace/delete, positional deletion, and sequence-number rules.
- Live preview before execution, with invalid characters, duplicate names, and target conflicts highlighted.
- Uses two-phase temporary renaming, so A/B filename swaps are supported.
- Rolls back completed items on failure to avoid damaging unprocessed files.

## Format Conversion

- Convert to JPEG, PNG, WebP, AVIF, and TIFF.
- Convert the current image, current group, or whole folder.
- Options include quality, compression level, progressive JPEG, lossless WebP, AVIF effort, preserve Exif/ICC, and preserve alpha.
- Output beside the source or to a selected folder, with conflict policies and result preview.
- Conversion writes new files only and never overwrites originals; successful single-image conversion can reveal the new file in the file manager.

## File Operations

- Move to trash/recycle bin, copy image, copy path, and reveal in file manager.
- File operations apply to the focused image.
- After deletion, the queue closes the gap and tries to refill the current group.

## Cache And Performance

- Thumbnails and previews are generated as WebP variants and stored in the local cache.
- SQLite indexes cached variants; changes to originals invalidate and rebuild cached files.
- Cache size is configurable in settings and evicted with an LRU policy.
- Exif summaries and MD5/SHA1 hashes are cached persistently to reduce repeated work.
- Single-image view prefers full originals; multi-view grids use lightweight previews for large images to reduce memory use.
- The queue sidebar is virtualized and renders only visible rows.

## Settings And Diagnostics

- Settings are stored in a local `settings.json` file and loaded before rendering the UI.
- Simplified Chinese and English UI languages can be switched immediately.
- The settings page includes browsing, safety, cache, quick-save, and diagnostics options.
- Folio remembers sorting, default multi-view mode, loop/sync zoom, quick-save rules, and default erase rules.
- Crash logs and application logs are stored locally and are not uploaded.

## Packaging And Platforms

- Unsigned macOS DMG builds are supported and verified to launch.
- macOS Developer ID signing/notarization, Windows/Linux artifacts, and the app icon are still pending.

## Fullscreen And Window

- `F11` fullscreen switching and macOS hidden title bar support.
- In fullscreen viewing, Folio uses an immersive layout where the toolbar, status bar, and queue slide in near the screen edges.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `←` / `→` or `A` / `D` | Previous / next image |
| `↑` / `↓` | Previous / next group |
| `Shift+←` / `Shift+→` | Previous / next group |
| `Home` / `End` | First / last image |
| `1`-`4` | Select multi-view focus slot |
| `Tab` / `Shift+Tab` | Change multi-view focus |
| `V` | Cycle single/2-up/3-up/4-up views |
| `Ctrl/Cmd+1..4` | Switch directly to a view count |
| `Enter` | Toggle focus image and grid |
| `Esc` | Return to grid or close Exif drawer |
| `S` | Toggle synchronized zoom |
| `I` | Toggle Exif drawer |
| `Space` | Fit / original size |
| `+` / `-` / `0` | Zoom in / zoom out / original size |
| `F` | Fit to window |
| `R` / `Shift+R` | Rotate / random image |
| `F11` | Toggle fullscreen |
| `T` | Quick-save current image |
| `Delete` / `Backspace` | Move to trash/recycle bin |
| `Cmd/Ctrl+C` | Copy image |
| `Cmd/Ctrl+Shift+C` | Copy path |
