import { useEffect } from 'react'
import { useT } from '../i18n'
import { loadFolder } from '../lib/actions'
import { useFolderStore } from '../stores/folderStore'
import { FolderIcon } from './icons'

/**
 * "Load next folder?" prompt (PRD §6.1): offered when the user steps past the last image of the
 * open folder and a following sibling folder has images.
 */
export function FolderPrompt(): React.JSX.Element | null {
  const t = useT()
  const next = useFolderStore((s) => s.nextFolder)
  const dismiss = useFolderStore((s) => s.dismissNextFolder)

  useEffect(() => {
    if (!next) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, dismiss])

  if (!next) return null

  const load = (): void => {
    dismiss()
    void loadFolder(next.path)
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click dismisses; Esc also dismisses
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-md"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dismiss()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="folder-prompt-title"
        className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1C1C1E] shadow-2xl"
      >
        <div className="flex items-start gap-3.5 border-b border-white/[0.06] px-5 py-4">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#0A84FF]/15 text-[#0A84FF]">
            <FolderIcon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="folder-prompt-title" className="text-[15px] font-semibold text-white">
              {t('folder.nextTitle')}
            </h2>
            <p className="mt-1 truncate font-mono text-[12px] text-[rgba(235,235,245,0.55)]">
              {next.name} · {t('queue.images', { count: next.imageCount })}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/[0.06] bg-[#161618] px-5 py-3">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg bg-white/[0.06] px-3.5 py-2 text-[13px] font-medium text-[rgba(235,235,245,0.86)] transition-colors hover:bg-white/[0.1]"
          >
            {t('folder.nextCancel')}
          </button>
          <button
            type="button"
            onClick={load}
            className="rounded-lg bg-[#0A84FF] px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#3395ff]"
          >
            {t('folder.nextConfirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
