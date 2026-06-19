import { describe, expect, it } from 'vitest'
import { detectImageFormat, mimeTypeForFormat } from './format'

/** Build a header buffer from leading bytes, zero-padded to a realistic length. */
function header(...bytes: number[]): Uint8Array {
  const buf = new Uint8Array(32)
  buf.set(bytes, 0)
  return buf
}

/** Build an ISO-BMFF header: 4-byte box size, "ftyp", then a 4-char major brand. */
function ftyp(brand: string): Uint8Array {
  const head = [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70] // size + "ftyp"
  return header(...head, ...[...brand].map((c) => c.charCodeAt(0)))
}

const ascii = (text: string) => header(...[...text].map((c) => c.charCodeAt(0)))

describe('detectImageFormat', () => {
  it('detects the simple signatures', () => {
    expect(detectImageFormat(header(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('png')
    expect(detectImageFormat(header(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg')
    expect(detectImageFormat(ascii('GIF89a'))).toBe('gif')
    expect(detectImageFormat(ascii('GIF87a'))).toBe('gif')
    expect(detectImageFormat(ascii('BM......'))).toBe('bmp')
  })

  it('detects both TIFF byte orders', () => {
    expect(detectImageFormat(header(0x49, 0x49, 0x2a, 0x00))).toBe('tiff') // little-endian
    expect(detectImageFormat(header(0x4d, 0x4d, 0x00, 0x2a))).toBe('tiff') // big-endian
  })

  it('detects WebP only with the WEBP form type', () => {
    const webp = header(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50) // RIFF…WEBP
    expect(detectImageFormat(webp)).toBe('webp')
    const wav = header(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45) // RIFF…WAVE
    expect(detectImageFormat(wav)).toBeNull()
  })

  it('detects JPEG XL codestream and container', () => {
    expect(detectImageFormat(header(0xff, 0x0a))).toBe('jxl')
    const container = header(0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a)
    expect(detectImageFormat(container)).toBe('jxl')
  })

  it('resolves ISO-BMFF brands to avif / heic / heif', () => {
    expect(detectImageFormat(ftyp('avif'))).toBe('avif')
    expect(detectImageFormat(ftyp('heic'))).toBe('heic')
    expect(detectImageFormat(ftyp('heix'))).toBe('heic')
    expect(detectImageFormat(ftyp('mif1'))).toBe('heif')
    expect(detectImageFormat(ftyp('isom'))).toBeNull() // plain MP4 — not an image
  })

  it('ignores a lying extension: a .png that is really a JPEG reads as jpeg', () => {
    expect(detectImageFormat(header(0xff, 0xd8, 0xff))).toBe('jpeg')
  })

  it('returns null for empty, short, or unknown headers', () => {
    expect(detectImageFormat(new Uint8Array(0))).toBeNull()
    expect(detectImageFormat(header(0xff))).toBeNull()
    expect(detectImageFormat(ascii('not an image'))).toBeNull()
  })
})

describe('mimeTypeForFormat', () => {
  it('maps every format to its MIME type', () => {
    expect(mimeTypeForFormat('jpeg')).toBe('image/jpeg')
    expect(mimeTypeForFormat('avif')).toBe('image/avif')
    expect(mimeTypeForFormat('jxl')).toBe('image/jxl')
  })
})
