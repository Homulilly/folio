import type { ScanResult } from '@folio/shared-types'
import { useQueueStore } from '../stores/queueStore'
import { useToastStore } from '../stores/toastStore'

const queue = () => useQueueStore.getState()
const toast = () => useToastStore.getState()

function applyResult(result: ScanResult | null): void {
  if (!result) {
    toast().show('No supported images found', 'error')
    return
  }
  useQueueStore.getState().loadResult(result)
}

export async function openFolder(): Promise<void> {
  applyResult(await window.gv.image.openDirectoryDialog())
}

export async function openFile(): Promise<void> {
  applyResult(await window.gv.image.openFileDialog())
}

export async function openPaths(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  applyResult(await window.gv.image.openPaths(paths))
}

function currentPath(): string | undefined {
  const s = queue()
  return s.items[s.currentIndex]?.filePath
}

export async function trashCurrent(): Promise<void> {
  const path = currentPath()
  if (!path) return
  const ok = await window.gv.file.trash(path)
  if (ok) {
    queue().removeCurrent()
    toast().show('Moved to Trash', 'success')
  } else {
    toast().show('Could not move to Trash', 'error')
  }
}

export async function copyPathCurrent(): Promise<void> {
  const path = currentPath()
  if (!path) return
  await window.gv.file.copyPath(path)
  toast().show('Path copied', 'success')
}

export async function copyImageCurrent(): Promise<void> {
  const path = currentPath()
  if (!path) return
  const ok = await window.gv.file.copyImage(path)
  toast().show(ok ? 'Image copied' : 'This format can’t be copied yet', ok ? 'success' : 'error')
}

export async function revealCurrent(): Promise<void> {
  const path = currentPath()
  if (path) await window.gv.file.showInFolder(path)
}

export async function toggleFullscreen(): Promise<void> {
  await window.gv.win.toggleFullscreen()
}
