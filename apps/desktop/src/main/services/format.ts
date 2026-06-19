import { open } from 'node:fs/promises'
import { detectImageFormat, MAGIC_BYTES_LENGTH } from '@folio/image-processing'
import type { ImageFormat } from '@folio/shared-types'

/**
 * Sniff a file's true format by reading only its leading {@link MAGIC_BYTES_LENGTH} bytes
 * (never the whole file). Returns null for unreadable files or unrecognised headers — never throws.
 */
export async function detectFileFormat(filePath: string): Promise<ImageFormat | null> {
  let handle: Awaited<ReturnType<typeof open>> | undefined
  try {
    handle = await open(filePath, 'r')
    const { buffer, bytesRead } = await handle.read(
      Buffer.alloc(MAGIC_BYTES_LENGTH),
      0,
      MAGIC_BYTES_LENGTH,
      0,
    )
    return detectImageFormat(buffer.subarray(0, bytesRead))
  } catch {
    return null
  } finally {
    await handle?.close()
  }
}
