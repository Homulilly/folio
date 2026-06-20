import { GV_IMG_SCHEME, type ImageFormat } from '@folio/shared-types'

/** What the renderable / label helpers need from a queue item: prefer the sniffed format, fall back to ext. */
type FormatInfo = { format?: ImageFormat; ext: string }

/** True formats Chromium can decode in an <img>. Others need a sharp-generated preview (later milestone). */
const RENDERABLE_FORMATS = new Set<ImageFormat>(['jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'])
/** Extension fallback for items whose format couldn't be sniffed (incl. svg/ico, which we don't sniff). */
const RENDERABLE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif', 'svg', 'ico'])

export function canRenderNatively({ format, ext }: FormatInfo): boolean {
  return format ? RENDERABLE_FORMATS.has(format) : RENDERABLE_EXTS.has(ext.toLowerCase())
}

/** Build a gv-img:// URL, percent-encoding each path segment while keeping separators. */
export function imageUrl(variant: 'original' | 'thumb' | 'preview', filePath: string): string {
  const normalized = filePath.replaceAll('\\', '/')
  const absolutePath = normalized.startsWith('/') ? normalized : `/${normalized}`
  const encoded = absolutePath.split('/').map(encodeURIComponent).join('/')
  return `${GV_IMG_SCHEME}://${variant}${encoded}`
}

/**
 * The gv-img variant to display an item with: the full-res original when Chromium can decode it,
 * otherwise the sharp-generated `preview` (webp) so HEIC/TIFF/etc. render instead of showing a
 * "preview unavailable" placeholder. Falls back to the placeholder only if preview generation also
 * fails (e.g. a format sharp can't decode, like JXL).
 */
export function displaySrc(item: FormatInfo & { filePath: string }): string {
  return canRenderNatively(item)
    ? imageUrl('original', item.filePath)
    : imageUrl('preview', item.filePath)
}

const FORMAT_LABELS: Record<ImageFormat, string> = {
  jpeg: 'JPEG',
  png: 'PNG',
  webp: 'WebP',
  gif: 'GIF',
  bmp: 'BMP',
  tiff: 'TIFF',
  avif: 'AVIF',
  heic: 'HEIC',
  heif: 'HEIF',
  jxl: 'JPEG XL',
}

const EXT_LABELS: Record<string, string> = {
  jpg: 'JPEG',
  jpeg: 'JPEG',
  png: 'PNG',
  webp: 'WebP',
  gif: 'GIF',
  bmp: 'BMP',
  tiff: 'TIFF',
  tif: 'TIFF',
  avif: 'AVIF',
  heic: 'HEIC',
  heif: 'HEIF',
  jxl: 'JPEG XL',
}

export function formatLabel({ format, ext }: FormatInfo): string {
  if (format) return FORMAT_LABELS[format]
  return EXT_LABELS[ext.toLowerCase()] ?? ext.toUpperCase()
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`
  return `${(mb / 1024).toFixed(1)} GB`
}
