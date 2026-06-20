import { createHash } from 'node:crypto'

// Pure spec + cache-key helpers for the cached image variants served over gv-img:// (thumb/preview).
// The actual sharp generation lives in the main process (services/thumbnail.ts); only the
// deterministic, side-effect-free policy lives here so it can be unit-tested.

/** Cached, sharp-generated variants of a source image (M7 cache). `original` streams the file as-is. */
export type CacheVariant = 'thumb' | 'preview'

export interface VariantSpec {
  /** Longest-edge pixel cap; the variant is fit inside a size×size box, never enlarged. */
  size: number
  /** Output container — webp gives small files with broad alpha + quality control. */
  format: 'webp'
  quality: number
}

/**
 * thumb: queue rail / filmstrip / multi-view grid cells.
 * preview: canvas display of huge or non-natively-decodable images (HEIC/TIFF/JXL) without
 * loading the full-res original.
 */
export const VARIANT_SPECS: Record<CacheVariant, VariantSpec> = {
  thumb: { size: 256, format: 'webp', quality: 70 },
  preview: { size: 2048, format: 'webp', quality: 80 },
}

export const CACHE_VARIANTS: readonly CacheVariant[] = ['thumb', 'preview']

export function isCacheVariant(value: string): value is CacheVariant {
  return value === 'thumb' || value === 'preview'
}

/**
 * Stable cache key (also the cache file's basename) for a variant of a source file.
 * Includes the variant spec so changing sizes/quality transparently invalidates old entries, and
 * the source mtime+byte-size so an edited-in-place file regenerates rather than serving a stale crop.
 */
export function variantCacheKey(
  srcPath: string,
  variant: CacheVariant,
  mtimeMs: number,
  srcBytes: number,
): string {
  const spec = VARIANT_SPECS[variant]
  return createHash('sha1')
    .update(
      `${variant}\0${spec.size}\0${spec.format}\0${spec.quality}\0${Math.round(mtimeMs)}\0${srcBytes}\0${srcPath}`,
    )
    .digest('hex')
}
