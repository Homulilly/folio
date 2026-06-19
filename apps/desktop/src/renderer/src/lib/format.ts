import { GV_IMG_SCHEME } from '@galleryviewer/shared-types'

/** Extensions Chromium can decode in an <img>. Others need a sharp-generated preview (later milestone). */
const RENDERABLE = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif', 'svg', 'ico'])

export function canRenderNatively(ext: string): boolean {
  return RENDERABLE.has(ext.toLowerCase())
}

/** Build a gv-img:// URL, percent-encoding each path segment while keeping separators. */
export function imageUrl(variant: 'original' | 'thumb' | 'preview', filePath: string): string {
  const encoded = filePath.split('/').map(encodeURIComponent).join('/')
  return `${GV_IMG_SCHEME}://${variant}${encoded}`
}

const FORMAT_LABELS: Record<string, string> = {
  jpg: 'JPEG',
  jpeg: 'JPEG',
  png: 'PNG',
  webp: 'WebP',
  gif: 'GIF',
  bmp: 'BMP',
  tiff: 'TIFF',
  tif: 'TIFF',
  avif: 'AVIF',
  heic: 'HEIF',
  heif: 'HEIF',
  jxl: 'JPEG XL',
}

export function formatLabel(ext: string): string {
  return FORMAT_LABELS[ext.toLowerCase()] ?? ext.toUpperCase()
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`
  return `${(mb / 1024).toFixed(1)} GB`
}
