// Format-conversion types (M6, PRD §6.9). Conversion writes a NEW file (different format/extension);
// the original is never overwritten (§13). The sharp pipeline lives in the main process; the pure
// extension/name/default-option helpers are in @folio/core.

import type { ConflictPolicy } from './save'

/** MVP output formats (PRD §6.9 输出格式). HEIC/JXL/PDF/ICO are enhancement-tier, deferred. */
export type ConvertFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'tiff'

/**
 * Conversion parameters. `format` + `quality` are always present; the rest are format-specific and
 * the main-process service applies only the ones relevant to the chosen format (PRD §6.9 转换参数).
 */
export interface ConvertOptions {
  format: ConvertFormat
  /** 1–100. Used by jpeg/webp/avif/tiff; ignored by png. */
  quality: number
  /** JPEG: progressive (interlaced) encoding. */
  progressive?: boolean
  /** PNG: zlib compression level 0–9. */
  compressionLevel?: number
  /** WebP: lossless mode (quality then governs effort, not loss). */
  lossless?: boolean
  /** AVIF: CPU effort 0–9 (higher = slower, smaller). */
  effort?: number
  /** AVIF: output bit depth. */
  bitdepth?: 8 | 10 | 12
  /** Keep Exif metadata in the output. */
  keepExif?: boolean
  /** Keep the ICC colour profile in the output. */
  keepIcc?: boolean
  /** Keep the alpha channel; when false, the image is flattened onto a background. */
  keepAlpha?: boolean
}

/**
 * A conversion request. A single focused image uses `file.convert` (direct); a group/folder uses
 * `task.startConvertBatch` (scheduler + batch page). Output goes to `targetDir` when set, else
 * beside each original. The same `options`/`conflict` apply to every file.
 */
export interface ConvertRequest {
  filePaths: string[]
  /** Output folder; when omitted, each output is written next to its source file. */
  targetDir?: string
  options: ConvertOptions
  /** What to do if the output name already exists (md5_compare is treated as `number` here). */
  conflict: ConflictPolicy
  /** Human-readable title for the batch page. */
  label?: string
}

export type ConvertStatus = 'success' | 'skipped' | 'failed'

export interface ConvertResult {
  filePath: string
  status: ConvertStatus
  outputPath?: string
  error?: string
}
