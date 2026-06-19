import type { ImageQueueItem, ScanResult } from '@folio/shared-types'
import { tNow } from '../i18n'
import { useQueueStore } from '../stores/queueStore'
import { useToastStore } from '../stores/toastStore'
import { useTrashConfirmStore } from '../stores/trashConfirmStore'
import { useUiStore } from '../stores/uiStore'
import { trashTextKeys } from './platform'

const queue = () => useQueueStore.getState()
const toast = () => useToastStore.getState()

function applyResult(result: ScanResult | null): void {
  if (!result) {
    toast().show(tNow('toast.noSupportedImages'), 'error')
    return
  }
  useQueueStore.getState().loadResult(result)
  useUiStore.getState().showViewer()
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
  const trashText = trashTextKeys()
  const confirmed = await useTrashConfirmStore.getState().confirmTrash(item.fileName)
  if (!confirmed) return

  const result = await window.gv.file.trash(item.filePath)
  if (result === 'trashed') {
    queue().removeItem(item.id)
    toast().show(tNow(trashText.success), 'success')
  } else if (result === 'failed') {
    toast().show(tNow(trashText.failed), 'error')
  }
}

export async function copyPathCurrent(): Promise<void> {
  const path = currentPath()
  if (!path) return
  await window.gv.file.copyPath(path)
  toast().show(tNow('toast.pathCopied'), 'success')
}

export async function copyImageCurrent(): Promise<void> {
  const path = currentPath()
  if (!path) return
  const ok = await window.gv.file.copyImage(path)
  toast().show(
    ok ? tNow('toast.imageCopied') : tNow('toast.imageCopyUnsupported'),
    ok ? 'success' : 'error',
  )
}

export async function revealCurrent(): Promise<void> {
  const path = currentPath()
  if (path) await window.gv.file.showInFolder(path)
}

export async function toggleFullscreen(): Promise<void> {
  await window.gv.win.toggleFullscreen()
}
