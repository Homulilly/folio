import type { ConvertFormat, ConvertOptions } from '@folio/shared-types'

// Pure helpers for format conversion (PRD §6.9). The sharp encode lives in the main process; this
// module owns the format list, extension mapping, output-name derivation, and default/clamped
// options — all unit-testable without sharp.

/** MVP output formats. */
export const CONVERT_FORMATS: ConvertFormat[] = ['jpeg', 'png', 'webp', 'avif', 'tiff']

const EXTENSION: Record<ConvertFormat, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  avif: 'avif',
  tiff: 'tiff',
}

/** File extension (no dot) for a target format. */
export function extensionForFormat(format: ConvertFormat): string {
  return EXTENSION[format]
}

/** Replace a file name's extension with the target format's. Dotfiles get the ext appended. */
export function outputNameForConvert(originalFileName: string, format: ConvertFormat): string {
  const dot = originalFileName.lastIndexOf('.')
  const base = dot > 0 ? originalFileName.slice(0, dot) : originalFileName
  return `${base}.${extensionForFormat(format)}`
}

/** Whether a format carries an alpha channel (so the "keep transparency" toggle is meaningful). */
export function formatSupportsAlpha(format: ConvertFormat): boolean {
  return format === 'png' || format === 'webp' || format === 'avif'
}

/** Sensible default options for a freshly-picked format (PRD §6.9 转换参数). */
export function defaultConvertOptions(format: ConvertFormat): ConvertOptions {
  const base: ConvertOptions = {
    format,
    quality: 82,
    keepExif: true,
    keepIcc: true,
    keepAlpha: true,
  }
  switch (format) {
    case 'jpeg':
      return { ...base, quality: 90, progressive: true, keepAlpha: false }
    case 'png':
      return { ...base, compressionLevel: 9 }
    case 'webp':
      return { ...base, quality: 80, lossless: false }
    case 'avif':
      return { ...base, quality: 50, effort: 4, bitdepth: 8 }
    case 'tiff':
      return { ...base, quality: 90, keepAlpha: false }
  }
}

const clampInt = (v: number | undefined, lo: number, hi: number, fallback: number): number => {
  if (v === undefined || Number.isNaN(v)) return fallback
  return Math.min(hi, Math.max(lo, Math.trunc(v)))
}

/** Clamp user-entered numeric options into valid ranges before handing them to sharp. */
export function clampConvertOptions(o: ConvertOptions): ConvertOptions {
  return {
    ...o,
    quality: clampInt(o.quality, 1, 100, 82),
    compressionLevel:
      o.compressionLevel === undefined ? undefined : clampInt(o.compressionLevel, 0, 9, 9),
    effort: o.effort === undefined ? undefined : clampInt(o.effort, 0, 9, 4),
  }
}
