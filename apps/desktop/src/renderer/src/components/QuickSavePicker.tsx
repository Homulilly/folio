import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { quickSaveTo } from '../lib/actions'
import { useSaveStore } from '../stores/saveStore'
import { FolderIcon } from './icons'

/** Last path segment (the folder's display name). */
const folderName = (p: string): string =>
  p.replaceAll('\\', '/').replace(/\/+$/, '').split('/').pop() ?? p

/**
 * Folder picker shown when the quick-save shortcut (T) fires and the rule has several target
 * folders. Pick one → the focused image is saved there with the rule's naming. With a single target
 * the shortcut sends directly and this never opens. ↑/↓ move the highlight, Enter confirms, Esc
 * cancels — handled in the capture phase so the global viewer shortcuts (arrows = prev/next image)
 * don't also fire underneath while the picker is open.
 */
export function QuickSavePicker(): React.JSX.Element | null {
  const t = useT()
  const open = useSaveStore((s) => s.quickPickerOpen)
  const close = useSaveStore((s) => s.closeQuickPicker)
  const dirs = useSaveStore((s) => s.quickRule?.targetDirs ?? [])
  const [index, setIndex] = useState(0)

  const pick = (dir: string): void => {
    close()
    void quickSaveTo(dir)
  }

  // Start the highlight at the top each time the picker opens.
  useEffect(() => {
    if (open) setIndex(0)
  }, [open])

  // biome-ignore lint/correctness/useExhaustiveDependencies: pick is stable; re-bind on index/dirs
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          e.stopPropagation()
          setIndex((i) => Math.min(dirs.length - 1, i + 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          e.stopPropagation()
          setIndex((i) => Math.max(0, i - 1))
          break
        case 'Enter':
          e.preventDefault()
          e.stopPropagation()
          if (dirs[index]) pick(dirs[index])
          break
        case 'Escape':
          e.preventDefault()
          e.stopPropagation()
          close()
          break
        default:
          // Swallow every other key too, so the viewer's nav shortcuts (←/→, A/D, Space, …)
          // don't switch the image underneath while the picker is open. No preventDefault, so OS
          // menu accelerators still work.
          e.stopPropagation()
      }
    }
    // Capture phase: stopPropagation here prevents the bubble-phase global shortcut handler
    // (also on window) from acting on the same key — navigation stays confined to the picker.
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [open, close, dirs, index])

  if (!open) return null

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click dismisses; Esc also dismisses
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-md"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('quickPicker.title')}
        className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1C1C1E] shadow-2xl"
      >
        <div className="border-b border-white/[0.06] px-5 py-3.5">
          <h2 className="text-[15px] font-semibold text-white">{t('quickPicker.title')}</h2>
          <p className="mt-0.5 text-[12px] text-[rgba(235,235,245,0.55)]">
            {t('quickPicker.help')}
          </p>
        </div>
        <div className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto p-3">
          {dirs.map((dir, i) => (
            <button
              type="button"
              key={dir}
              onClick={() => pick(dir)}
              onMouseEnter={() => setIndex(i)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                i === index
                  ? 'bg-[#0A84FF]/20 ring-1 ring-inset ring-[#0A84FF]/40'
                  : 'hover:bg-white/[0.06]'
              }`}
            >
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-white/[0.06] text-[rgba(235,235,245,0.7)]">
                <FolderIcon size={17} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] font-medium text-white">
                  {i + 1}. {folderName(dir)}
                </span>
                <span className="truncate font-mono text-[11px] text-[rgba(235,235,245,0.4)]">
                  {dir}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
