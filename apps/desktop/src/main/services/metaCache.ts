import type { ExifMetadata } from '@folio/shared-types'
import { getDb } from './db'

// Persistent (cross-restart) caches for Exif summaries and file hashes, in the same SQLite DB as the
// variant cache. These sit behind the small in-memory hot caches in exiftool.ts / hash.ts as the L2
// layer: a session-cold read that used to re-shell ExifTool or re-stream the whole file for a hash
// now hits SQLite instead. Both invalidate on the source file's mtime (rounded to ms to avoid
// float-repr jitter across sessions) and are bounded by row count with LRU eviction.

const EXIF_LIMIT = 4000
const HASH_LIMIT = 50000

let ready = false
function ensure(): import('better-sqlite3').Database {
  const db = getDb()
  if (ready) return db
  db.exec(`
    CREATE TABLE IF NOT EXISTS exif (
      path         TEXT PRIMARY KEY,
      src_mtime_ms INTEGER NOT NULL,
      json         TEXT NOT NULL,
      accessed_ms  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS exif_lru ON exif (accessed_ms);
    CREATE TABLE IF NOT EXISTS hashes (
      path         TEXT NOT NULL,
      algo         TEXT NOT NULL,
      src_mtime_ms INTEGER NOT NULL,
      hex          TEXT NOT NULL,
      accessed_ms  INTEGER NOT NULL,
      PRIMARY KEY (path, algo)
    );
    CREATE INDEX IF NOT EXISTS hashes_lru ON hashes (accessed_ms);
  `)
  ready = true
  return db
}

/** Delete rows beyond the newest `limit` (by accessed_ms) — the LRU tail. */
function prune(table: 'exif' | 'hashes', limit: number): void {
  getDb()
    .prepare(
      `DELETE FROM ${table} WHERE rowid IN (
         SELECT rowid FROM ${table} ORDER BY accessed_ms DESC LIMIT -1 OFFSET ?
       )`,
    )
    .run(limit)
}

export function getExif(path: string, mtimeMs: number): ExifMetadata | null {
  const db = ensure()
  const row = db.prepare('SELECT src_mtime_ms, json FROM exif WHERE path = ?').get(path) as
    | { src_mtime_ms: number; json: string }
    | undefined
  if (!row || row.src_mtime_ms !== Math.round(mtimeMs)) return null
  db.prepare('UPDATE exif SET accessed_ms = ? WHERE path = ?').run(Date.now(), path)
  try {
    return JSON.parse(row.json) as ExifMetadata
  } catch {
    return null
  }
}

export function putExif(path: string, mtimeMs: number, data: ExifMetadata): void {
  const db = ensure()
  db.prepare(
    'INSERT OR REPLACE INTO exif (path, src_mtime_ms, json, accessed_ms) VALUES (?, ?, ?, ?)',
  ).run(path, Math.round(mtimeMs), JSON.stringify(data), Date.now())
  prune('exif', EXIF_LIMIT)
}

/** Invalidate a cached Exif summary (e.g. after an in-place erase rewrites the file). */
export function dropExif(path: string): void {
  ensure().prepare('DELETE FROM exif WHERE path = ?').run(path)
}

export function getHash(path: string, algo: string, mtimeMs: number): string | null {
  const db = ensure()
  const row = db
    .prepare('SELECT src_mtime_ms, hex FROM hashes WHERE path = ? AND algo = ?')
    .get(path, algo) as { src_mtime_ms: number; hex: string } | undefined
  if (!row || row.src_mtime_ms !== Math.round(mtimeMs)) return null
  db.prepare('UPDATE hashes SET accessed_ms = ? WHERE path = ? AND algo = ?').run(
    Date.now(),
    path,
    algo,
  )
  return row.hex
}

export function putHash(path: string, algo: string, mtimeMs: number, hex: string): void {
  const db = ensure()
  db.prepare(
    'INSERT OR REPLACE INTO hashes (path, algo, src_mtime_ms, hex, accessed_ms) VALUES (?, ?, ?, ?, ?)',
  ).run(path, algo, Math.round(mtimeMs), hex, Date.now())
  prune('hashes', HASH_LIMIT)
}
