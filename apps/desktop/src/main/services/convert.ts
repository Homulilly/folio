import { randomUUID } from 'node:crypto'
import { mkdir, rm, stat } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { outputNameForConvert } from '@folio/core'
import type { ConflictPolicy, ConvertOptions, ConvertResult } from '@folio/shared-types'
import sharp from 'sharp'
import { cacheDir } from './db'
import { decodeToPng } from './decode'
import { suggestExportPath } from './paths'

// Format conversion (PRD §6.9). sharp's async pipeline offloads to libvips threads, so this runs in
// the main process without blocking the JS event loop (no Worker-Threads infra needed — see the M6
// spike). §13 safety: only ever writes a NEW file; the original is never overwritten or deleted,
// and a guard forces a fresh name if the output path would land on the source itself.

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

/** Resolve the output path under the conflict policy, never landing on the source file. */
async function resolveTarget(
  intended: string,
  conflict: ConflictPolicy,
  sourcePath: string,
): Promise<{ path: string; skip: boolean }> {
  // Converting in place (same dir, e.g. jpg→jpg) would clobber the original — always pick a free name.
  if (intended === sourcePath) return { path: await suggestExportPath(intended, ''), skip: false }
  if (!(await exists(intended))) return { path: intended, skip: false }
  // md5_compare is meaningless for a re-encoded file; treat it as auto-number.
  if (conflict === 'skip') return { path: intended, skip: true }
  if (conflict === 'overwrite') return { path: intended, skip: false }
  return { path: await suggestExportPath(intended, ''), skip: false }
}

/** Apply format + metadata options to a sharp pipeline. */
function encode(pipeline: sharp.Sharp, o: ConvertOptions): sharp.Sharp {
  let img = pipeline
  if (o.keepExif) img = img.keepExif()
  if (o.keepIcc) img = img.keepIccProfile()
  if (o.keepAlpha === false) img = img.flatten({ background: '#ffffff' })

  switch (o.format) {
    case 'jpeg':
      return img.jpeg({ quality: o.quality, progressive: o.progressive })
    case 'png':
      return img.png({ compressionLevel: o.compressionLevel ?? 9, progressive: o.progressive })
    case 'webp':
      return img.webp({ quality: o.quality, lossless: o.lossless })
    case 'avif':
      return img.avif({ quality: o.quality, effort: o.effort ?? 4, bitdepth: o.bitdepth ?? 8 })
    case 'tiff':
      return img.tiff({ quality: o.quality })
  }
}

/**
 * Convert one image. Output goes to `targetDir` (or beside the source when undefined) named after
 * the original with the target extension. Returns the per-file result; never throws for an expected
 * failure so a batch keeps going. The original is left untouched on any outcome.
 */
export async function convertFile(
  filePath: string,
  targetDir: string | undefined,
  options: ConvertOptions,
  conflict: ConflictPolicy,
): Promise<ConvertResult> {
  try {
    const dir = targetDir ?? dirname(filePath)
    const intended = join(dir, outputNameForConvert(basename(filePath), options.format))
    const { path: outputPath, skip } = await resolveTarget(intended, conflict, filePath)
    if (skip) return { filePath, status: 'skipped', outputPath }

    // failOn:'error' tolerates non-fatal warnings (truncated trailers etc.) but rejects real corruption.
    try {
      await encode(sharp(filePath, { failOn: 'error' }), options).toFile(outputPath)
    } catch (sharpErr) {
      // sharp can't decode the input (HEIC/JXL). Decode it via the OS layer to an intermediate PNG
      // (orientation baked in, ICC preserved), then encode that. Original EXIF tags are lost on this
      // path — the intermediate PNG doesn't carry them; exiftool re-copy is a later refinement.
      const tmp = join(cacheDir(), 'convert', `${randomUUID()}.png`)
      await mkdir(dirname(tmp), { recursive: true })
      try {
        if (!(await decodeToPng(filePath, tmp, 120_000))) throw sharpErr
        await encode(sharp(tmp, { failOn: 'error' }), options).toFile(outputPath)
      } finally {
        await rm(tmp, { force: true })
      }
    }
    return { filePath, status: 'success', outputPath }
  } catch (e) {
    return { filePath, status: 'failed', error: e instanceof Error ? e.message : String(e) }
  }
}
