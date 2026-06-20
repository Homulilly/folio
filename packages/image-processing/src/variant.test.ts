import { describe, expect, it } from 'vitest'
import { CACHE_VARIANTS, isCacheVariant, VARIANT_SPECS, variantCacheKey } from './variant'

describe('variant specs', () => {
  it('defines a spec for every cache variant', () => {
    for (const v of CACHE_VARIANTS) {
      expect(VARIANT_SPECS[v]).toBeDefined()
      expect(VARIANT_SPECS[v].size).toBeGreaterThan(0)
    }
  })

  it('preview is larger than thumb', () => {
    expect(VARIANT_SPECS.preview.size).toBeGreaterThan(VARIANT_SPECS.thumb.size)
  })
})

describe('isCacheVariant', () => {
  it('accepts thumb and preview, rejects original and junk', () => {
    expect(isCacheVariant('thumb')).toBe(true)
    expect(isCacheVariant('preview')).toBe(true)
    expect(isCacheVariant('original')).toBe(false)
    expect(isCacheVariant('')).toBe(false)
  })
})

describe('variantCacheKey', () => {
  const path = '/photos/a.jpg'

  it('is a stable 40-char sha1 hex', () => {
    const key = variantCacheKey(path, 'thumb', 1000, 5000)
    expect(key).toMatch(/^[0-9a-f]{40}$/)
    expect(variantCacheKey(path, 'thumb', 1000, 5000)).toBe(key)
  })

  it('differs by variant', () => {
    expect(variantCacheKey(path, 'thumb', 1000, 5000)).not.toBe(
      variantCacheKey(path, 'preview', 1000, 5000),
    )
  })

  it('changes when the source mtime changes (edited in place)', () => {
    expect(variantCacheKey(path, 'thumb', 1000, 5000)).not.toBe(
      variantCacheKey(path, 'thumb', 2000, 5000),
    )
  })

  it('changes when the source byte size changes', () => {
    expect(variantCacheKey(path, 'thumb', 1000, 5000)).not.toBe(
      variantCacheKey(path, 'thumb', 1000, 6000),
    )
  })

  it('rounds fractional mtime so sub-millisecond jitter does not thrash the cache', () => {
    expect(variantCacheKey(path, 'thumb', 1000.4, 5000)).toBe(
      variantCacheKey(path, 'thumb', 1000, 5000),
    )
  })

  it('differs by source path', () => {
    expect(variantCacheKey('/photos/a.jpg', 'thumb', 1000, 5000)).not.toBe(
      variantCacheKey('/photos/b.jpg', 'thumb', 1000, 5000),
    )
  })
})
