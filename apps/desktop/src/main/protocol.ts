import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { mimeTypeForFormat } from '@folio/image-processing'
import { GV_IMG_SCHEME } from '@folio/shared-types'
import { protocol } from 'electron'
import { detectFileFormat } from './services/format'

/**
 * Declare gv-img:// as a privileged, streaming scheme. MUST run before app `ready`.
 * The renderer loads images via <img src="gv-img://original/<absolute-path>"> so bytes
 * stream through Chromium's loader instead of being base64-marshalled over IPC.
 */
export function registerImageProtocolSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: GV_IMG_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
  ])
}

/**
 * Handle gv-img:// requests. M0 only serves `original/<path>` by streaming the file as-is.
 * M1+ adds `thumb/` and `preview/` variants generated on demand by sharp (with caching).
 */
export function handleImageProtocol(): void {
  protocol.handle(GV_IMG_SCHEME, async (request) => {
    const url = new URL(request.url)
    // host = variant (original|thumb|preview); pathname = the source file path.
    const variant = url.hostname
    let filePath = decodeURIComponent(url.pathname)
    if (process.platform === 'win32' && /^\/[a-zA-Z]:\//.test(filePath)) {
      filePath = filePath.slice(1)
    }

    if (variant !== 'original') {
      return new Response('Not implemented', { status: 501 })
    }

    try {
      const info = await stat(filePath)
      if (!info.isFile()) return new Response('Not found', { status: 404 })
      // Label the response by the file's true format (magic bytes), not its extension.
      const format = await detectFileFormat(filePath)
      const headers = format ? { 'Content-Type': mimeTypeForFormat(format) } : undefined
      const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream
      return new Response(stream, { status: 200, headers })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}
