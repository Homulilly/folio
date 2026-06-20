import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { app } from 'electron'

// Single SQLite connection backing the M7 caches (thumbnail/preview index now; Exif summaries and
// hashes move here in Phase B). better-sqlite3 is synchronous and fast, which suits the main
// process — no extra worker/IPC hop. The connection opens lazily on first use (must be after app
// `ready`, since it needs userData) and is closed on app quit.

let db: Database.Database | null = null
let dir = ''

/** Per-user cache directory (under Electron's userData). Generated variant files live in subdirs. */
export function cacheDir(): string {
  if (!dir) dir = join(app.getPath('userData'), 'cache')
  return dir
}

/** Lazily open the cache database in WAL mode. Safe to call repeatedly. */
export function getDb(): Database.Database {
  if (db) return db
  mkdirSync(cacheDir(), { recursive: true })
  db = new Database(join(cacheDir(), 'folio-cache.db'))
  // WAL + NORMAL: durable enough for a regenerable cache, far less fsync overhead than the default.
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  return db
}

/** Close the connection (called on will-quit so the WAL is checkpointed cleanly). */
export function closeDb(): void {
  db?.close()
  db = null
}
