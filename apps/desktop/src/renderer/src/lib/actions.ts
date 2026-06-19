import type { ImageQueueItem, ScanResult } from '@folio/shared-types'
import { useQueueStore } from '../stores/queueStore'
import { useToastStore } from '../stores/toastStore'
import { useTrashConfirmStore } from '../stores/trashConfirmStore'

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

function currentItem(): ImageQueueItem | undefined {
  const s = queue()
  return s.items[s.currentIndex]
}

function currentPath(): string | undefined {
  return currentItem()?.filePath
}

export async function trashCurrent(): Promise<void> {
  const item = currentItem()
  if (!item) return
  const confirmed = await useTrashConfirmStore.getState().confirmTrash(item.fileName)
  if (!confirmed) return

  const result = await window.gv.file.trash(item.filePath)
  if (result === 'trashed') {
    queue().removeItem(item.id)
    toast().show('Moved to Trash', 'success')
  } else if (result === 'failed') {
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
