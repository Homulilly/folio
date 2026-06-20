import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { getHash, putHash } from './metaCache'

// File hashing for save-to-target naming ({md5}/{sha1}) and md5-compare conflict handling (PRD §6.7).
// Streamed via createReadStream + createHash so large files don't buffer in memory and I/O stays
// async (no event-loop block). Worker-Threads offload is deferred (see mvp-tasks M7 group B); a small
// in-memory L1 cache avoids re-hashing within one batch, and the SQLite L2 (metaCache) persists
// digests across restarts so re-saving the same folder later doesn't re-stream every file.

export type HashAlgo = 'md5' | 'sha1'

interface CacheEntry {
  mtimeMs: number
  hex: string
}

const CACHE_LIMIT = 256
const cache = new Map<string, CacheEntry>()

const keyOf = (filePath: string, algo: HashAlgo): string => `${algo}:${filePath}`

/** Hash a file's bytes, returning a lower-case hex digest. Cached by path + mtime + algorithm. */
export async function hashFile(filePath: string, algo: HashAlgo): Promise<string> {
  const mtimeMs = (await stat(filePath)).mtimeMs
  const key = keyOf(filePath, algo)
  const cached = cache.get(key)
  if (cached && cached.mtimeMs === mtimeMs) {
    cache.delete(key)
    cache.set(key, cached) // refresh recency
    return cached.hex
  }

  // L2: persistent SQLite cache (survives restarts), invalidated on mtime change.
  const persisted = getHash(filePath, algo, mtimeMs)
  if (persisted !== null) {
    remember(key, mtimeMs, persisted)
    return persisted
  }

  const hex = await new Promise<string>((resolve, reject) => {
    const hash = createHash(algo)
    const stream = createReadStream(filePath)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })

  remember(key, mtimeMs, hex)
  putHash(filePath, algo, mtimeMs, hex)
  return hex
}

/** Store in the bounded in-memory L1 cache, evicting the oldest entry past the limit. */
function remember(key: string, mtimeMs: number, hex: string): void {
  cache.set(key, { mtimeMs, hex })
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
}
