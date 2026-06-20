import type { Stats } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { extOf, isSupportedImage } from '@folio/image-processing'
import type {
  DirEntry,
  DirListing,
  ImageFormat,
  ImageQueueItem,
  ScanResult,
} from '@folio/shared-types'
import { detectFileFormat } from './format'

const STAT_CONCURRENCY = 32

function toItem(filePath: string, s: Stats, format: ImageFormat | null): ImageQueueItem {
  return {
    id: filePath,
    filePath,
    fileName: basename(filePath),
    ext: extOf(filePath),
    format: format ?? undefined,
    size: s.size,
    modifiedAt: s.mtimeMs,
    createdAt: s.birthtimeMs || undefined,
    metadataStatus: 'pending',
  }
}

/** Stat a file and sniff its true format from magic bytes in one bounded step. */
async function inspect(filePath: string, s: Stats): Promise<ImageQueueItem> {
  return toItem(filePath, s, await detectFileFormat(filePath))
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
    return inspect(filePath, await stat(filePath))
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
        if (s.isFile() && isSupportedImage(p)) items.push(await inspect(p, s))
      } catch {
        /* skip unreadable paths */
      }
    }),
  )
  return items.length ? { items, currentIndex: 0 } : null
}

/** Hidden (dot-prefixed) entries are skipped throughout the folder browser. */
const isHidden = (name: string): boolean => name.startsWith('.')

/** Cheap, extension-only counts of a directory's direct children — no stat, no magic bytes. */
async function countChildren(dir: string): Promise<{ imageCount: number; subdirCount: number }> {
  let imageCount = 0
  let subdirCount = 0
  try {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (e.isFile() && isSupportedImage(e.name)) imageCount++
      else if (e.isDirectory() && !isHidden(e.name)) subdirCount++
    }
  } catch {
    /* unreadable subfolder → reported as empty */
  }
  return { imageCount, subdirCount }
}

/**
 * List a directory's immediate subdirectories for the queue rail's folder browser.
 * Each entry carries cheap child counts (images / subfolders) used to hint and to find the
 * next folder with images. Returns null if the directory itself can't be read.
 */
export async function listDirectory(directory: string): Promise<DirListing | null> {
  let names: string[]
  try {
    const entries = await readdir(directory, { withFileTypes: true })
    names = entries.filter((e) => e.isDirectory() && !isHidden(e.name)).map((e) => e.name)
  } catch {
    return null
  }
  const directories: DirEntry[] = await mapLimit(names, STAT_CONCURRENCY, async (name) => {
    const path = join(directory, name)
    return { name, path, ...(await countChildren(path)) }
  })
  directories.sort((a, b) => a.name.localeCompare(b.name))
  const parent = dirname(directory)
  return {
    path: directory,
    parent: parent === directory ? null : parent,
    name: basename(directory) || directory,
    directories,
  }
}
