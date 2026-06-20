import { mkdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { type CacheVariant, VARIANT_SPECS, variantCacheKey } from '@folio/image-processing'
import sharp from 'sharp'
import { cacheDir, getDb } from './db'

// On-disk budget per variant before LRU eviction kicks in. Hardcoded for now; M7 Phase D wires these
// to settings.json (thumbnail/previewCacheSizeMB).
const CACHE_BUDGET_BYTES: Record<CacheVariant, number> = {
  thumb: 512 * 1024 * 1024,
  preview: 1024 * 1024 * 1024,
}

// Generate-on-demand thumbnail/preview variants served over gv-img://, cached to disk and indexed
// in SQLite. sharp's async pipeline offloads decode/resize to libvips threads, so this stays off the
// JS event loop without a dedicated Worker (same reasoning as the M6 convert service). Cached
// variant bytes are NEVER read into the renderer over IPC — protocol.ts streams the cache file.

export interface CachedVariant {
  /** Absolute path to the generated cache file. */
  path: string
  /** Output container (always webp for now) — used to set the protocol Content-Type. */
  format: 'webp'
}

interface VariantRow {
  file: string
  format: 'webp'
}

let tableReady = false
function ensureTable(): import('better-sqlite3').Database {
  const db = getDb()
  if (tableReady) return db
  db.exec(`
    CREATE TABLE IF NOT EXISTS variants (
      key          TEXT PRIMARY KEY,
      src_path     TEXT NOT NULL,
      variant      TEXT NOT NULL,
      file         TEXT NOT NULL,
      format       TEXT NOT NULL,
      width        INTEGER,
      height       INTEGER,
      bytes        INTEGER NOT NULL,
      src_mtime_ms INTEGER NOT NULL,
      created_ms   INTEGER NOT NULL,
      accessed_ms  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS variants_lru ON variants (variant, accessed_ms);
  `)
  tableReady = true
  return db
}

// Coalesce concurrent requests for the same key (the queue rail can ask for one thumb many times),
// and cap how many sharp pipelines run at once so opening a 1000-image folder can't melt the CPU/RAM.
const inFlight = new Map<string, Promise<CachedVariant | null>>()
const MAX_CONCURRENT = Math.max(2, (sharp.concurrency() || 4) - 1)
let active = 0
const waiting: Array<() => void> = []

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++
    return Promise.resolve()
  }
  return new Promise((resolve) => waiting.push(resolve))
}

function release(): void {
  const next = waiting.shift()
  if (next) next()
  else active--
}

/**
 * Resolve a cached variant for `srcPath`, generating it on a miss. Returns null when the source is
 * missing/undecodable (the caller falls back to a text badge). Keyed by path+variant+mtime+size, so
 * editing the source in place transparently regenerates.
 */
export async function getVariant(
  srcPath: string,
  variant: CacheVariant,
): Promise<CachedVariant | null> {
  let info: Awaited<ReturnType<typeof stat>>
  try {
    info = await stat(srcPath)
  } catch {
    return null
  }
  if (!info.isFile()) return null

  const key = variantCacheKey(srcPath, variant, info.mtimeMs, info.size)
  const existing = inFlight.get(key)
  if (existing) return existing

  const job = produce(srcPath, variant, key, info.mtimeMs).finally(() => inFlight.delete(key))
  inFlight.set(key, job)
  return job
}

async function produce(
  srcPath: string,
  variant: CacheVariant,
  key: string,
  mtimeMs: number,
): Promise<CachedVariant | null> {
  const db = ensureTable()
  const spec = VARIANT_SPECS[variant]
  const dir = join(cacheDir(), variant)
  const row = db.prepare('SELECT file, format FROM variants WHERE key = ?').get(key) as
    | VariantRow
    | undefined

  // Cache hit — confirm the file still exists (a user could have cleared the dir), then touch LRU.
  if (row) {
    const filePath = join(dir, row.file)
    try {
      await stat(filePath)
      db.prepare('UPDATE variants SET accessed_ms = ? WHERE key = ?').run(Date.now(), key)
      return { path: filePath, format: row.format }
    } catch {
      // Indexed but the file vanished — fall through and regenerate.
    }
  }

  const fileName = `${key}.${spec.format}`
  const filePath = join(dir, fileName)
  await acquire()
  try {
    await mkdir(dir, { recursive: true })
    const out = await sharp(srcPath, { failOn: 'none', animated: false })
      .rotate() // bake in EXIF orientation so the thumbnail isn't sideways
      .resize(spec.size, spec.size, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: spec.quality })
      .toFile(filePath)
    const now = Date.now()
    db.prepare(
      `INSERT OR REPLACE INTO variants
       (key, src_path, variant, file, format, width, height, bytes, src_mtime_ms, created_ms, accessed_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      key,
      srcPath,
      variant,
      fileName,
      spec.format,
      out.width,
      out.height,
      out.size,
      Math.round(mtimeMs),
      now,
      now,
    )
    schedulePrune(variant)
    return { path: filePath, format: spec.format }
  } catch {
    // Undecodable format (e.g. JXL without libjxl) or a read error — let the caller fall back.
    return null
  } finally {
    release()
  }
}

// Evict least-recently-used variant files once a variant's on-disk total exceeds its budget.
// Throttled: a big folder open inserts hundreds of rows, so we prune in batches rather than after
// every single insert (and never while we'd just evict thumbs the current view still needs).
const insertsSincePrune: Record<CacheVariant, number> = { thumb: 0, preview: 0 }
const PRUNE_EVERY = 128

function schedulePrune(variant: CacheVariant): void {
  insertsSincePrune[variant] += 1
  if (insertsSincePrune[variant] < PRUNE_EVERY) return
  insertsSincePrune[variant] = 0
  void pruneVariant(variant)
}

async function pruneVariant(variant: CacheVariant): Promise<void> {
  const db = ensureTable()
  const budget = CACHE_BUDGET_BYTES[variant]
  const total =
    (
      db.prepare('SELECT SUM(bytes) AS n FROM variants WHERE variant = ?').get(variant) as {
        n: number | null
      }
    ).n ?? 0
  if (total <= budget) return

  // Drop oldest-accessed entries (delete file then row) until back under budget.
  const dir = join(cacheDir(), variant)
  const victims = db
    .prepare('SELECT key, file, bytes FROM variants WHERE variant = ? ORDER BY accessed_ms ASC')
    .all(variant) as Array<{ key: string; file: string; bytes: number }>
  const del = db.prepare('DELETE FROM variants WHERE key = ?')
  let freed = 0
  for (const v of victims) {
    if (total - freed <= budget) break
    await rm(join(dir, v.file), { force: true })
    del.run(v.key)
    freed += v.bytes
  }
}
