import { stat } from 'node:fs/promises'
import sharp from 'sharp'
import { osDimensions } from './decode'

// Cheap source-dimension probe: sharp.metadata() reads the header only (no full decode), so the
// viewer can decide whether an image is large enough to display via the preview variant instead of
// the full original. Bounded in-memory cache, invalidated on mtime (the SQLite layer is overkill for
// a tiny width/height pair). Formats sharp can't read (tiled HEIC, JXL) fall back to the OS decode
// layer's osDimensions().

interface Dims {
  width: number
  height: number
}

const LIMIT = 512
const cache = new Map<string, { mtimeMs: number; dims: Dims | null }>()

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
  // sharp couldn't read it (e.g. tiled HEIC the prebuilt libheif rejects, or JXL) — try the OS probe.
  if (!dims) dims = await osDimensions(filePath)

  cache.set(filePath, { mtimeMs, dims })
  if (cache.size > LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  return dims
}
