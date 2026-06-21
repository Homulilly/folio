import { execFile } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { promisify } from 'node:util'
import type { ImageFormat } from '@folio/shared-types'
import { detectFileFormat } from './format'

// Unified OS-level decode for formats sharp/libvips can't handle — HEVC-coded HEIC (prebuilt libheif
// has no HEVC decoder), JPEG XL (libvips has no JXL), and BMP (no libvips BMP loader). The renderer
// never sees this: thumbnail / preview / dimensions / convert all funnel undecodable sources through
// here into an intermediate PNG the normal sharp pipeline can then consume. macOS uses the system
// `sips` (CoreImage/ImageIO); Windows/Linux providers land in Phase 2/3.
//
// Gated on an explicit allow-list of the sniffed magic-byte format (not the extension, so a HEIC
// named `.jpg` still works). ICO is intentionally absent: it isn't magic-byte sniffed (format=null),
// so it's never OS-decoded — ICO still displays via Chromium (the original variant) but isn't a
// conversion input.
//
// Security: every call is execFile + an argument array (never a shell), so the source path can't
// inject; callers own the temp output path and its cleanup. Functions never throw.

const execFileAsync = promisify(execFile)

const OS_DECODABLE_FORMATS = new Set<ImageFormat>(['heic', 'heif', 'jxl', 'bmp'])

/** Whether the OS image stack can decode this source. macOS only (Windows/Linux: Phase 2/3); gated on
 *  the sniffed format, so null-format files (e.g. ICO/SVG) and non-allow-listed formats return false. */
async function osCanDecode(srcPath: string): Promise<boolean> {
  if (process.platform !== 'darwin') return false
  const fmt = await detectFileFormat(srcPath)
  return fmt != null && OS_DECODABLE_FORMATS.has(fmt)
}

/**
 * Decode `srcPath` into a PNG at `outPath` using the OS image stack. Returns true on success, false
 * if the format isn't OS-decodable here or the decode failed. The orientation is baked into the
 * pixels by the decoder, so the output PNG is already upright.
 */
export async function decodeToPng(
  srcPath: string,
  outPath: string,
  timeoutMs = 60_000,
): Promise<boolean> {
  if (!(await osCanDecode(srcPath))) return false
  try {
    await execFileAsync('sips', ['-s', 'format', 'png', srcPath, '--out', outPath], {
      timeout: timeoutMs,
    })
    await stat(outPath) // confirm sips actually wrote it
    return true
  } catch {
    return false
  }
}

/**
 * True pixel dimensions of an OS-decodable image, read without a full decode (sharp's metadata()
 * chokes on tiled HEIC and can't read JXL/BMP at all). macOS: `sips -g`. Null if not OS-decodable
 * here or on failure.
 */
export async function osDimensions(
  srcPath: string,
): Promise<{ width: number; height: number } | null> {
  if (!(await osCanDecode(srcPath))) return null
  try {
    const { stdout } = await execFileAsync(
      'sips',
      ['-g', 'pixelWidth', '-g', 'pixelHeight', srcPath],
      { timeout: 15_000 },
    )
    const width = Number(stdout.match(/pixelWidth:\s*(\d+)/)?.[1])
    const height = Number(stdout.match(/pixelHeight:\s*(\d+)/)?.[1])
    if (width > 0 && height > 0) return { width, height }
  } catch {
    // fall through to null
  }
  return null
}
