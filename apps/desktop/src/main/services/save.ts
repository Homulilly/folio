import { copyFile, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import {
  formatName,
  type NamingContext,
  sanitizeFilename,
  templateNeedsHash,
  tokensIn,
} from '@folio/core'
import type { ConflictPolicy, NamingOptions, SaveFileInput, SaveResult } from '@folio/shared-types'
import { hashFile } from './hash'
import { suggestExportPath } from './paths'

// Save-to-target (PRD §6.7). Copies an image into a chosen folder under a computed name. §13 safety:
// only ever *copies* — the original is never moved or modified, and we refuse to write onto the
// source file. Naming/conflict policy live here; the pure template engine is in @folio/core.

/** Date/time stamp shared by every file in one save (so `{date}`/`{time}` are consistent). */
export interface SaveStamp {
  date: string
  time: string
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

/** `YYYY-MM-DD` from epoch ms (for the `{mtime}` token). */
function ymd(ms: number): string {
  const d = new Date(ms)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Resolve the output file name (basename, incl. extension) for one input. */
async function buildName(
  input: SaveFileInput,
  ordinal: number,
  naming: NamingOptions,
  stamp: SaveStamp,
): Promise<string> {
  const { filePath } = input
  const dotExt = extname(filePath)
  const ext = dotExt.replace(/^\./, '')
  const original = basename(filePath)

  if (naming.kind === 'keep') return original
  if (naming.kind === 'md5' || naming.kind === 'sha1') {
    const hex = await hashFile(filePath, naming.kind)
    return ext ? `${hex}.${ext}` : hex
  }

  const template = naming.template ?? '{name}.{ext}'
  const tokens = tokensIn(template)
  const need = templateNeedsHash(template)
  const ctx: NamingContext = {
    name: basename(filePath, dotExt),
    ext,
    md5: need.md5 ? await hashFile(filePath, 'md5') : undefined,
    sha1: need.sha1 ? await hashFile(filePath, 'sha1') : undefined,
    date: stamp.date,
    time: stamp.time,
    mtime: tokens.has('mtime') ? ymd((await stat(filePath)).mtimeMs) : undefined,
    width: input.width,
    height: input.height,
    index: input.index,
    nr: ordinal + 1,
  }
  const resolved = sanitizeFilename(formatName(template, ctx))
  // A template that sanitises to nothing falls back to the original name rather than failing.
  return resolved || original
}

/** Decide the final path given a conflict policy. `skip` means "leave the existing file, don't write". */
async function resolveTarget(
  targetPath: string,
  conflict: ConflictPolicy,
  sourcePath: string,
): Promise<{ path: string; skip: boolean }> {
  if (!(await exists(targetPath))) return { path: targetPath, skip: false }
  switch (conflict) {
    case 'skip':
      return { path: targetPath, skip: true }
    case 'overwrite':
      return { path: targetPath, skip: false }
    case 'number':
      return { path: await suggestExportPath(targetPath, ''), skip: false }
    case 'md5_compare': {
      // Identical content → nothing to do; otherwise keep both via auto-numbering.
      const [a, b] = await Promise.all([hashFile(sourcePath, 'md5'), hashFile(targetPath, 'md5')])
      return a === b
        ? { path: targetPath, skip: true }
        : { path: await suggestExportPath(targetPath, ''), skip: false }
    }
  }
}

/**
 * Save one image into `targetDir`. Returns the per-file result; never throws for an expected failure
 * (returns a `failed` result instead) so a batch keeps going.
 * @param ordinal 0-based position within the batch (drives `{nr}`).
 */
export async function saveFile(
  input: SaveFileInput,
  ordinal: number,
  targetDir: string,
  naming: NamingOptions,
  conflict: ConflictPolicy,
  stamp: SaveStamp,
): Promise<SaveResult> {
  const { filePath } = input
  try {
    const name = await buildName(input, ordinal, naming, stamp)
    const intended = join(targetDir, name)
    const { path: outputPath, skip } = await resolveTarget(intended, conflict, filePath)

    // Never write onto the source itself (saving into the same folder under the same name).
    if (outputPath === filePath) return { filePath, status: 'skipped', outputPath: filePath }
    if (skip) return { filePath, status: 'skipped', outputPath }

    await copyFile(filePath, outputPath)
    return { filePath, status: 'success', outputPath }
  } catch (e) {
    return { filePath, status: 'failed', error: e instanceof Error ? e.message : String(e) }
  }
}

/** A `SaveStamp` for the current moment (called once per batch by the scheduler / IPC handler). */
export function nowStamp(): SaveStamp {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    time: `${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`,
  }
}
