import { copyFile, stat, unlink } from 'node:fs/promises'
import { buildExifGroups, buildRemoveArgs, validateRule, verifyRemoval } from '@folio/core'
import type {
  EraseResult,
  EraseRule,
  EraseTarget,
  ExifGroup,
  ExifMetadata,
} from '@folio/shared-types'
import { exiftool } from 'exiftool-vendored'
import { dropExif, getExif, putExif } from './metaCache'

// exiftool-vendored manages a persistent ExifTool child-process pool and queues reads itself,
// so this service is just a thin wrapper: read with family-0 grouping (`-G0`), normalise via the
// pure core helpers, and memoise per file. Two cache layers: a bounded in-memory L1 (hot, this
// session) over a persistent SQLite L2 (metaCache, PRD §10.2) so a session-cold read of an
// already-seen image skips re-shelling ExifTool. Both invalidate on the file's mtime.

interface CacheEntry {
  mtimeMs: number
  data: ExifMetadata
}

const CACHE_LIMIT = 64
const cache = new Map<string, CacheEntry>()

/** Read + group tags fresh from disk (no cache). */
async function readGroups(filePath: string): Promise<ExifGroup[]> {
  const raw = await exiftool.readRaw(filePath, { readArgs: ['-G0'] })
  return buildExifGroups(raw as Record<string, unknown>)
}

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

  // L2: persistent SQLite summary cache (survives restarts), invalidated on mtime change.
  const persisted = getExif(filePath, mtimeMs)
  if (persisted) {
    remember(filePath, mtimeMs, persisted)
    return persisted
  }

  try {
    const data: ExifMetadata = { filePath, groups: await readGroups(filePath) }
    remember(filePath, mtimeMs, data)
    putExif(filePath, mtimeMs, data)
    return data
  } catch {
    return null
  }
}

/** Store in the bounded in-memory L1 cache, evicting the oldest entry past the limit. */
function remember(filePath: string, mtimeMs: number, data: ExifMetadata): void {
  cache.set(filePath, { mtimeMs, data })
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
}

/**
 * Erase metadata from one file per `rule`, honouring the §13 safety baseline:
 * - `export` writes a stripped copy to a target path; the original is never modified, and a
 *   partial copy is removed if the write fails. Refuses to clobber an existing target.
 * - `in_place` overwrites the original with no backup (export is the safe alternative).
 * On success the output is re-read and the requested removals are verified (§6.5). The original
 * is never deleted on failure.
 */
export async function eraseMetadata(
  filePath: string,
  rule: EraseRule,
  target: EraseTarget,
): Promise<EraseResult> {
  const check = validateRule(rule)
  if (!check.valid) {
    return {
      filePath,
      status: 'failed',
      error: `Invalid tag pattern(s): ${check.invalid.join(', ')}`,
    }
  }
  if (rule.mode === 'remove_selected' && rule.removeTags.length === 0) {
    return { filePath, status: 'skipped', error: 'No tags selected' }
  }

  const output = target.kind === 'export' ? target.targetPath : filePath

  try {
    if (target.kind === 'export') {
      // Never silently clobber an existing file — the renderer must pick a free path.
      if (await exists(target.targetPath)) {
        return { filePath, status: 'failed', error: 'Target file already exists' }
      }
      await copyFile(filePath, target.targetPath)
    }

    // Always overwrite the target in place (the export copy, or the original) — no `_original`
    // sidecar; the safe path is `export`, where the untouched original is the backup.
    if (rule.mode === 'remove_selected') {
      await exiftool.write(
        output,
        {},
        { writeArgs: [...buildRemoveArgs(rule), '-overwrite_original'] },
      )
    } else {
      await exiftool.deleteAllTags(output, { retain: rule.keepTags })
      await unlink(`${output}_original`).catch(() => {})
    }

    cache.delete(output)
    dropExif(output)
    const { verifiedRemoved, stillPresent } = verifyRemoval(rule, await readGroups(output))
    return { filePath, status: 'success', outputPath: output, verifiedRemoved, stillPresent }
  } catch (e) {
    // Failure must not leave a half-written export copy, and must never touch the original.
    if (target.kind === 'export') await unlink(target.targetPath).catch(() => {})
    return { filePath, status: 'failed', error: e instanceof Error ? e.message : String(e) }
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
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
