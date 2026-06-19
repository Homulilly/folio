import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { app } from 'electron'

const MAX_RECENT = 12

function storePath(): string {
  return join(app.getPath('userData'), 'recent-folders.json')
}

async function read(): Promise<string[]> {
  try {
    const raw = await readFile(storePath(), 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

async function write(list: string[]): Promise<void> {
  const file = storePath()
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(list, null, 2), 'utf-8')
}

/** Most-recently-used directories, newest first. */
export async function listRecentFolders(): Promise<string[]> {
  return read()
}

export async function addRecentFolder(directory: string): Promise<void> {
  const list = await read()
  const next = [directory, ...list.filter((d) => d !== directory)].slice(0, MAX_RECENT)
  await write(next)
}

export async function removeRecentFolder(directory: string): Promise<void> {
  const list = await read()
  await write(list.filter((d) => d !== directory))
}

export async function clearRecentFolders(): Promise<void> {
  await write([])
}
