import { execFile } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { promisify } from 'node:util'
import type { ImageFormat } from '@folio/shared-types'
import sharp from 'sharp'
import { detectFileFormat } from './format'

// Cheap source-dimension probe: sharp.metadata() reads the header only (no full decode), so the
// viewer can decide whether an image is large enough to display via the preview variant instead of
// the full original. Bounded in-memory cache, invalidated on mtime (the SQLite layer is overkill for
// a tiny width/height pair).

interface Dims {
  width: number
  height: number
}

const LIMIT = 512
const cache = new Map<string, { mtimeMs: number; dims: Dims | null }>()

const execFileAsync = promisify(execFile)
// HEIC/HEIF: handled by the macOS sips fallback (sharp's libheif can't read tiled grids — see below).
const OS_DIM_FORMATS = new Set<ImageFormat>(['heic', 'heif'])

/**
 * macOS fallback for dimensions sharp can't read. Large HEICs are stored as tiled grids, and the
 * prebuilt libheif rejects them at metadata time ("Security limit exceeded: Number of references in
 * iref box exceeds 16") — so without this the viewer gets no natural size and can't zoom/fit. `sips`
 * reads the true pixel dimensions. Args go through execFile (no shell), so the path can't inject.
 * Gated on the sniffed magic-byte format, not the extension, so a HEIC named `.jpg` still works.
 */
async function sipsDimensions(filePath: string): Promise<Dims | null> {
  if (process.platform !== 'darwin') return null
  const fmt = await detectFileFormat(filePath)
  if (!fmt || !OS_DIM_FORMATS.has(fmt)) return null
  try {
    const { stdout } = await execFileAsync(
      'sips',
      ['-g', 'pixelWidth', '-g', 'pixelHeight', filePath],
      { timeout: 15_000 },
    )
    const width = Number(stdout.match(/pixelWidth:\s*(\d+)/)?.[1])
    const height = Number(stdout.match(/pixelHeight:\s*(\d+)/)?.[1])
    if (width > 0 && height > 0) return { width, height }
  } catch {
    // sips missing/failed — fall through to null.
  }
  return null
}

export async function imageDimensions(filePath: string): Promise<Dims | null> {
  let mtimeMs: number
  try {
    mtimeMs = (await stat(filePath)).mtimeMs
  } catch {
    return null
  }
  const hit = cache.get(filePath)
  if (hit && hit.mtimeMs === mtimeMs) return hit.dims

  let dims: Dims | null = null
  try {
    const m = await sharp(filePath, { failOn: 'none' }).metadata()
    if (m.width && m.height) {
      // EXIF orientation 5–8 rotates by 90°, swapping the displayed width/height — match how the
      // browser auto-orients the <img> and how the rotated preview is written.
      const swap = (m.orientation ?? 0) >= 5
      dims = swap ? { width: m.height, height: m.width } : { width: m.width, height: m.height }
    }
  } catch {
    dims = null
  }
  // sharp couldn't read it (e.g. tiled HEIC the prebuilt libheif rejects) — try the OS probe.
  if (!dims) dims = await sipsDimensions(filePath)

  cache.set(filePath, { mtimeMs, dims })
  if (cache.size > LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  return dims
}
