import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { isCacheVariant, mimeTypeForFormat } from '@folio/image-processing'
import { GV_IMG_SCHEME } from '@folio/shared-types'
import { protocol } from 'electron'
import { detectFileFormat } from './services/format'
import { getVariant } from './services/thumbnail'

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

/** Stream a file from disk as a 200 response, labelled with the given Content-Type. */
function streamFile(path: string, contentType?: string): Response {
  const headers = contentType ? { 'Content-Type': contentType } : undefined
  const stream = Readable.toWeb(createReadStream(path)) as ReadableStream
  return new Response(stream, { status: 200, headers })
}

/**
 * Handle gv-img:// requests. `original/<path>` streams the file as-is; `thumb/` and `preview/`
 * stream a sharp-generated, SQLite-cached variant (M7), regenerating on a cache miss.
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

    if (isCacheVariant(variant)) {
      // Returns null for missing/undecodable sources; the renderer falls back to a text badge.
      const cached = await getVariant(filePath, variant)
      if (!cached) return new Response('Cannot generate variant', { status: 415 })
      return streamFile(cached.path, mimeTypeForFormat(cached.format))
    }

    if (variant !== 'original') {
      return new Response('Not implemented', { status: 501 })
    }

    try {
      const info = await stat(filePath)
      if (!info.isFile()) return new Response('Not found', { status: 404 })
      // Label the response by the file's true format (magic bytes), not its extension.
      const format = await detectFileFormat(filePath)
      return streamFile(filePath, format ? mimeTypeForFormat(format) : undefined)
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}
