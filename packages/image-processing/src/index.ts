// Image processing layer. sharp-backed decode/thumbnail/preview/convert lands here in M1+.
// M0: only pure, dependency-free format helpers used by the directory scanner.

export * from './format'
export * from './variant'

/** Extensions the viewer will enqueue when scanning a folder (PRD §6.3 base + modern). */
export const SUPPORTED_EXTENSIONS: ReadonlySet<string> = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'bmp',
  'tiff',
  'tif',
  'avif',
  'heic',
  'heif',
  'jxl',
  // Vector / icon: not magic-byte sniffed (format stays undefined), rendered by Chromium via the
  // original variant; the queue thumbnail falls back to the original when sharp can't rasterize them.
  'svg',
  'ico',
])

/** Lower-cased extension without the dot, or '' when there is none. */
export function extOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot < 0 || dot === fileName.length - 1) return ''
  return fileName.slice(dot + 1).toLowerCase()
}

export function isSupportedImage(fileName: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extOf(fileName))
}
