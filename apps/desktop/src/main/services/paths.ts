import { stat } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

/**
 * A guaranteed-non-existing export path next to the source: `<dir>/<base><suffix><ext>`, falling
 * back to `<base><suffix>-2<ext>`, `-3`, … on conflict. Used to name erased/exported copies
 * without ever clobbering an existing file (PRD §13). TOCTOU is backstopped by the erase service,
 * which still refuses to overwrite an existing target.
 */
export async function suggestExportPath(filePath: string, suffix: string): Promise<string> {
  const dir = dirname(filePath)
  const ext = extname(filePath)
  const base = basename(filePath, ext)
  let candidate = join(dir, `${base}${suffix}${ext}`)
  let n = 2
  while (await exists(candidate)) {
    candidate = join(dir, `${base}${suffix}-${n}${ext}`)
    n++
  }
  return candidate
}
