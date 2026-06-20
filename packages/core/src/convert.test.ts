import { describe, expect, it } from 'vitest'
import {
  clampConvertOptions,
  defaultConvertOptions,
  extensionForFormat,
  formatSupportsAlpha,
  outputNameForConvert,
} from './convert'

describe('extensionForFormat', () => {
  it('maps formats to extensions (jpeg→jpg)', () => {
    expect(extensionForFormat('jpeg')).toBe('jpg')
    expect(extensionForFormat('png')).toBe('png')
    expect(extensionForFormat('avif')).toBe('avif')
  })
})

describe('outputNameForConvert', () => {
  it('replaces the extension', () => {
    expect(outputNameForConvert('photo.png', 'webp')).toBe('photo.webp')
    expect(outputNameForConvert('IMG_0001.JPG', 'avif')).toBe('IMG_0001.avif')
  })
  it('keeps dots inside the base name', () => {
    expect(outputNameForConvert('a.b.c.tiff', 'jpeg')).toBe('a.b.c.jpg')
  })
  it('appends to a dotfile with no real extension', () => {
    expect(outputNameForConvert('.gitignore', 'png')).toBe('.gitignore.png')
  })
})

describe('formatSupportsAlpha', () => {
  it('is true for png/webp/avif, false for jpeg/tiff', () => {
    expect(formatSupportsAlpha('png')).toBe(true)
    expect(formatSupportsAlpha('webp')).toBe(true)
    expect(formatSupportsAlpha('jpeg')).toBe(false)
    expect(formatSupportsAlpha('tiff')).toBe(false)
  })
})

describe('defaultConvertOptions', () => {
  it('jpeg defaults to progressive, no alpha', () => {
    const o = defaultConvertOptions('jpeg')
    expect(o.progressive).toBe(true)
    expect(o.keepAlpha).toBe(false)
  })
  it('avif carries effort + bitdepth', () => {
    const o = defaultConvertOptions('avif')
    expect(o.effort).toBe(4)
    expect(o.bitdepth).toBe(8)
  })
})

describe('clampConvertOptions', () => {
  it('clamps quality / compressionLevel / effort into range', () => {
    const o = clampConvertOptions({
      format: 'avif',
      quality: 999,
      compressionLevel: -5,
      effort: 42,
    })
    expect(o.quality).toBe(100)
    expect(o.compressionLevel).toBe(0)
    expect(o.effort).toBe(9)
  })
  it('leaves undefined optionals undefined', () => {
    const o = clampConvertOptions({ format: 'jpeg', quality: 80 })
    expect(o.compressionLevel).toBeUndefined()
    expect(o.effort).toBeUndefined()
  })
})
