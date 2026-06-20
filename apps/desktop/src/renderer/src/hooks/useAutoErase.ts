import { useEffect } from 'react'
import { tNow } from '../i18n'
import { dirOf, useAutoModeStore } from '../stores/autoModeStore'
import { useQueueStore } from '../stores/queueStore'
import { useToastStore } from '../stores/toastStore'

/**
 * Session auto-mode (PRD §6.6): when active, navigating to an unprocessed image in the auto-mode
 * directory exports a metadata-free copy of it. Always export-new — never touches the original —
 * so auto-firing on plain navigation is safe. Keyed on the focused image id.
 */
export function useAutoErase(): void {
  const currentId = useQueueStore((s) => s.items[s.currentIndex]?.id)

  // biome-ignore lint/correctness/useExhaustiveDependencies: fire when the focused image changes
  useEffect(() => {
    const auto = useAutoModeStore.getState()
    if (!auto.active || !auto.rule || !auto.directory) return

    const q = useQueueStore.getState()
    const item = q.items[q.currentIndex]
    if (!item || dirOf(item.filePath) !== auto.directory) return
    if (auto.processed.includes(item.filePath)) return

    // Mark processed synchronously so a re-render can't double-fire before the write resolves.
    auto.markProcessed(item.filePath)
    const rule = auto.rule

    void (async () => {
      const toast = useToastStore.getState().show
      try {
        const targetPath = await window.gv.file.suggestExportPath(item.filePath, '-noexif')
        const res = await window.gv.metadata.erase(item.filePath, rule, {
          kind: 'export',
          targetPath,
        })
        toast(
          tNow(res.status === 'success' ? 'auto.applied' : 'auto.failed', { file: item.fileName }),
          res.status === 'success' ? 'success' : 'error',
        )
      } catch {
        toast(tNow('auto.failed', { file: item.fileName }), 'error')
      }
    })()
  }, [currentId])
}
