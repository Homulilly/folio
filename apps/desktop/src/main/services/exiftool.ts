import { stat } from 'node:fs/promises'
import { buildExifGroups } from '@folio/core'
import type { ExifMetadata } from '@folio/shared-types'
import { exiftool } from 'exiftool-vendored'

// exiftool-vendored manages a persistent ExifTool child-process pool and queues reads itself,
// so this service is just a thin wrapper: read with family-0 grouping (`-G0`), normalise via the
// pure core helpers, and memoise per file. The persistent SQLite summary cache (PRD §10.2) is
// deferred to M7 alongside the rest of the cache infra — here we keep a bounded in-memory cache,
// invalidated when the file's mtime changes.

interface CacheEntry {
  mtimeMs: number
  data: ExifMetadata
}

const CACHE_LIMIT = 64
const cache = new Map<string, CacheEntry>()

/**
 * Read full grouped metadata for one image. Returns null on any failure (missing file, ExifTool
 * error) so a bad read never breaks browsing. Cached by path + mtime.
 */
export async function readMetadata(filePath: string): Promise<ExifMetadata | null> {
  let mtimeMs: number
  try {
    mtimeMs = (await stat(filePath)).mtimeMs
  } catch {
    return null
  }

  const cached = cache.get(filePath)
  if (cached && cached.mtimeMs === mtimeMs) {
    // Refresh recency so the bounded cache evicts genuinely-cold entries.
    cache.delete(filePath)
    cache.set(filePath, cached)
    return cached.data
  }

  try {
    const raw = await exiftool.readRaw(filePath, { readArgs: ['-G0'] })
    const data: ExifMetadata = { filePath, groups: buildExifGroups(raw as Record<string, unknown>) }
    cache.set(filePath, { mtimeMs, data })
    if (cache.size > CACHE_LIMIT) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
    return data
  } catch {
    return null
  }
}

/** Shut down the persistent ExifTool child process(es). Call once on app quit. */
export async function endExifTool(): Promise<void> {
  try {
    await exiftool.end()
  } catch {
    /* already ended / never started */
  }
}
