import type { ImageQueueItem, ScanResult } from '@folio/shared-types'
import { type I18nKey, tNow } from '../i18n'
import { useConvertStore } from '../stores/convertStore'
import { useFolderStore } from '../stores/folderStore'
import { useMultiViewStore } from '../stores/multiViewStore'
import { useQueueStore } from '../stores/queueStore'
import { useRenameStore } from '../stores/renameStore'
import { useSaveStore } from '../stores/saveStore'
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

/** Load a folder picked in the queue rail's folder browser. Empty folders raise a toast. */
export async function loadFolder(path: string): Promise<void> {
  applyResult(await window.gv.image.openPaths([path]))
}

/** Re-scan the open folder, keeping the user on the same image and refreshing the folder browser. */
export async function refreshQueue(): Promise<void> {
  const dir = queue().directory
  if (!dir) return
  const result = await window.gv.image.openPaths([dir])
  if (!result) {
    toast().show(tNow('toast.noSupportedImages'), 'error')
    return
  }
  queue().loadResult(result, { keepFocus: true })
  if (useFolderStore.getState().open) void useFolderStore.getState().refresh()
}

/** Whether a forward single-image step exists in the current queue (looping always does). */
function hasForwardImage(): boolean {
  const s = queue()
  return useMultiViewStore.getState().loopEnabled || s.currentIndex < s.items.length - 1
}

/**
 * Step to the next image; at the end of a non-looping queue, offer to load the next sibling
 * folder instead (PRD §6.1). Used by the → / D shortcuts.
 */
export async function advance(): Promise<void> {
  if (hasForwardImage()) {
    useMultiViewStore.getState().nextImage()
    return
  }
  await useFolderStore.getState().offerNextFolder()
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

/** Open the save-to-target dialog (no-op when no images are loaded). */
export function openSaveDialog(): void {
  if (queue().items.length === 0) return
  useSaveStore.getState().openDialog()
}

/** Open the batch-rename dialog (no-op when no folder is open). */
export function openRenameDialog(): void {
  if (queue().items.length === 0) return
  useRenameStore.getState().openDialog()
}

/** Open the format-conversion dialog (no-op when no images are loaded). */
export function openConvertDialog(): void {
  if (queue().items.length === 0) return
  useConvertStore.getState().openDialog()
}

const baseNameOf = (p: string): string => p.replaceAll('\\', '/').split('/').pop() ?? p

/**
 * One-click "quick save" of the focused image (T / quick button). The first time, there is no
 * remembered rule yet, so it opens the dialog to establish one; afterwards it saves directly with
 * the session quick-save rule (PRD §6.7). The right-click menu always opens the full dialog.
 */
export async function quickSaveCurrent(): Promise<void> {
  const item = currentItem()
  if (!item) return
  const save = useSaveStore.getState()
  const rule = save.quickRule
  // No rule / no target yet → open the dialog to set one up (it records the rule on first save).
  if (!rule || rule.targetDirs.length === 0) {
    save.openDialog()
    return
  }
  // One target → send directly; several → let the user pick which folder.
  if (rule.targetDirs.length === 1) {
    await quickSaveTo(rule.targetDirs[0] as string)
    return
  }
  save.openQuickPicker()
}

/** Quick-save the focused image into a specific remembered target folder, using the rule's naming. */
export async function quickSaveTo(targetDir: string): Promise<void> {
  const item = currentItem()
  const rule = useSaveStore.getState().quickRule
  if (!item || !rule) return
  const [res] = await window.gv.file.saveToTarget({
    files: [{ filePath: item.filePath, index: queue().currentIndex + 1 }],
    targetDir,
    naming: rule.naming,
    conflict: rule.conflict,
  })
  if (!res || res.status === 'failed') {
    toast().show(tNow('toast.saveFailed', { error: res?.error ?? '' }), 'error')
  } else if (res.status === 'skipped') {
    toast().show(tNow('toast.saveSkipped'), 'error')
  } else {
    toast().show(tNow('toast.quickSaved', { name: baseNameOf(res.outputPath ?? '') }), 'success')
  }
}

/** Copy arbitrary text (an Exif field, or the full metadata JSON) to the clipboard. */
export async function copyText(text: string, toastKey: I18nKey = 'toast.copied'): Promise<void> {
  if (!text) return
  await window.gv.clipboard.writeText(text)
  toast().show(tNow(toastKey), 'success')
}
