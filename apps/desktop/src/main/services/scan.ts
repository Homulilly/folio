import type { Stats } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { extOf, isSupportedImage } from '@folio/image-processing'
import type { ImageQueueItem, ScanResult } from '@folio/shared-types'

const STAT_CONCURRENCY = 32

function toItem(filePath: string, s: Stats): ImageQueueItem {
  return {
    id: filePath,
    filePath,
    fileName: basename(filePath),
    ext: extOf(filePath),
    size: s.size,
    modifiedAt: s.mtimeMs,
    createdAt: s.birthtimeMs || undefined,
    metadataStatus: 'pending',
  }
}

/** Map over items with a bounded number of concurrent async calls. */
async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index] as T)
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker)
  await Promise.all(workers)
  return results
}

/** Scan a directory (non-recursive) for supported images. Stats are read concurrently; no image bytes are touched. */
export async function scanDirectory(directory: string): Promise<ImageQueueItem[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const names = entries.filter((e) => e.isFile() && isSupportedImage(e.name)).map((e) => e.name)
  const items = await mapLimit(names, STAT_CONCURRENCY, async (name) => {
    const filePath = join(directory, name)
    return toItem(filePath, await stat(filePath))
  })
  return items
}

/**
 * Build a queue from a set of paths (files and/or directories):
 * - one directory  → scan it
 * - one image file → scan its containing folder and focus that file
 * - many paths     → queue exactly the supported image files among them
 */
export async function buildScanResult(paths: readonly string[]): Promise<ScanResult | null> {
  if (paths.length === 0) return null

  if (paths.length === 1) {
    const p = paths[0] as string
    let s: Stats
    try {
      s = await stat(p)
    } catch {
      return null
    }
    if (s.isDirectory()) {
      const items = await scanDirectory(p)
      return items.length ? { directory: p, items, currentIndex: 0 } : null
    }
    if (s.isFile() && isSupportedImage(p)) {
      const dir = dirname(p)
      const items = await scanDirectory(dir)
      const idx = items.findIndex((it) => it.filePath === p)
      return { directory: dir, items, currentIndex: idx >= 0 ? idx : 0 }
    }
    return null
  }

  const items: ImageQueueItem[] = []
  await Promise.all(
    paths.map(async (p) => {
      try {
        const s = await stat(p)
        if (s.isFile() && isSupportedImage(p)) items.push(toItem(p, s))
      } catch {
        /* skip unreadable paths */
      }
    }),
  )
  return items.length ? { items, currentIndex: 0 } : null
}
