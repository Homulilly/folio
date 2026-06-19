// Magic-byte ("file signature") detection of an image's true format, independent of its
// extension. Pure and dependency-free — works on a header buffer and is fully unit-testable.
// Reading that header off disk lives main-side (apps/desktop services/format), keeping this
// package free of Node APIs.

import type { ImageFormat } from '@folio/shared-types'

/**
 * Bytes to read for detection. The ISO-BMFF brand sits at offset 8–12 and the JXL
 * container signature is 12 bytes, so 32 covers every supported format with margin.
 */
export const MAGIC_BYTES_LENGTH = 32

function matches(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false
  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature[i]) return false
  }
  return true
}

function asciiEquals(bytes: Uint8Array, offset: number, text: string): boolean {
  if (bytes.length < offset + text.length) return false
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false
  }
  return true
}

/** Read up to `length` ASCII chars at `offset` (stops at the buffer end). */
function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    const b = bytes[offset + i]
    if (b === undefined) break
    out += String.fromCharCode(b)
  }
  return out
}

/** Resolve an ISO-BMFF (`ftyp`) container to a concrete image format by its major brand. */
function isoBmffFormat(bytes: Uint8Array): ImageFormat | null {
  const brand = asciiAt(bytes, 8, 4)
  if (brand === 'avif' || brand === 'avis') return 'avif'
  // heic / heix / heim / heis / hevc / hevx — the HEVC-coded HEIF family.
  if (brand.startsWith('hei') || brand.startsWith('hev')) return 'heic'
  // mif1 / msf1 — generic (often AV1- or other-coded) HEIF.
  if (brand === 'mif1' || brand === 'msf1' || brand === 'heif') return 'heif'
  return null
}

/**
 * Identify an image's true format from its leading bytes (magic numbers), ignoring the
 * file extension. Returns null when the header matches no supported format.
 */
export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (matches(bytes, [0xff, 0xd8, 0xff])) return 'jpeg'
  if (asciiEquals(bytes, 0, 'GIF8')) return 'gif' // GIF87a / GIF89a
  if (asciiEquals(bytes, 0, 'BM')) return 'bmp'
  // TIFF: "II*\0" (little-endian) or "MM\0*" (big-endian).
  if (matches(bytes, [0x49, 0x49, 0x2a, 0x00]) || matches(bytes, [0x4d, 0x4d, 0x00, 0x2a]))
    return 'tiff'
  // WebP: a RIFF container whose form type is "WEBP".
  if (asciiEquals(bytes, 0, 'RIFF') && asciiEquals(bytes, 8, 'WEBP')) return 'webp'
  // JPEG XL: bare codestream (FF 0A) or its ISO-BMFF container box.
  if (matches(bytes, [0xff, 0x0a])) return 'jxl'
  if (matches(bytes, [0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a]))
    return 'jxl'
  // ISO-BMFF family (AVIF / HEIC / HEIF): "ftyp" box at offset 4, brand at offset 8.
  if (asciiEquals(bytes, 4, 'ftyp')) return isoBmffFormat(bytes)
  return null
}

const MIME_TYPES: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
  jxl: 'image/jxl',
}

export function mimeTypeForFormat(format: ImageFormat): string {
  return MIME_TYPES[format]
}
