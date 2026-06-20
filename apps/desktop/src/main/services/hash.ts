import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'

// File hashing for save-to-target naming ({md5}/{sha1}) and md5-compare conflict handling (PRD §6.7).
// Streamed via createReadStream + createHash so large files don't buffer in memory and I/O stays
// async (no event-loop block). Worker-Threads offload is deferred to M7 with the rest of the cache
// infra; here a small path+mtime+algo cache avoids re-hashing a file for both naming and conflict
// comparison within one batch.

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

  const hex = await new Promise<string>((resolve, reject) => {
    const hash = createHash(algo)
    const stream = createReadStream(filePath)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })

  cache.set(key, { mtimeMs, hex })
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  return hex
}
