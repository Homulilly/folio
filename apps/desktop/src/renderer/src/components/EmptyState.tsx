import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { openFile, openFolder, openPaths } from '../lib/actions'
import { FolderIcon, ImageIcon, TrashIcon } from './icons'

function basename(p: string): string {
  return p.split('/').filter(Boolean).pop() ?? p
}

export function EmptyState(): React.JSX.Element {
  const t = useT()
  const [recent, setRecent] = useState<string[]>([])
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)

  useEffect(() => {
    void window.gv.recent.list().then(setRecent)
  }, [])

  useEffect(() => {
    if (!clearConfirmOpen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setClearConfirmOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clearConfirmOpen])

  const removeRecent = async (dir: string): Promise<void> => {
    await window.gv.recent.remove(dir)
    setRecent((list) => list.filter((item) => item !== dir))
  }

  const clearRecent = async (): Promise<void> => {
    await window.gv.recent.clear()
    setRecent([])
    setClearConfirmOpen(false)
  }

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center"
      style={{ background: 'radial-gradient(circle at 50% 38%, #131315 0%, #000 78%)' }}
    >
      <div>
        <div className="text-2xl font-semibold tracking-tight">{t('empty.title')}</div>
        <div className="mt-2 text-sm text-[rgba(235,235,245,0.5)]">{t('empty.subtitle')}</div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={openFolder}
          className="flex items-center gap-2 rounded-xl bg-[#0A84FF] px-4 py-2.5 text-sm font-semibold text-white"
        >
          <FolderIcon size={17} />
          {t('empty.openFolder')}
        </button>
        <button
          type="button"
          onClick={openFile}
          className="flex items-center gap-2 rounded-xl bg-[#2C2C2E] px-4 py-2.5 text-sm font-semibold text-[rgba(235,235,245,0.85)]"
        >
          <ImageIcon size={17} />
          {t('empty.openFile')}
        </button>
      </div>

      {recent.length > 0 && (
        <div className="w-full max-w-md">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-left text-[11px] font-semibold uppercase tracking-wide text-[rgba(235,235,245,0.4)]">
              {t('empty.recentFolders')}
            </div>
            <button
              type="button"
              onClick={() => setClearConfirmOpen(true)}
              className="rounded-md px-2 py-1 text-[11px] font-medium text-[#FF6961] transition-colors hover:bg-[#FF453A]/15 hover:text-[#FF453A]"
            >
              {t('empty.clearRecentFolders')}
            </button>
          </div>
          <div className="overflow-hidden rounded-xl bg-[#1C1C1E]">
            {recent.slice(0, 6).map((dir) => (
              <div
                key={dir}
                className="flex items-center border-b border-[rgba(84,84,88,0.4)] last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => openPaths([dir])}
                  title={dir}
                  className="flex min-w-0 flex-1 items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-white/[0.04]"
                >
                  <FolderIcon size={15} className="flex-none text-[rgba(235,235,245,0.5)]" />
                  <span className="truncate text-[13px] text-[rgba(235,235,245,0.85)]">
                    {basename(dir)}
                  </span>
                  <span className="ml-auto truncate font-mono text-[11px] text-[rgba(235,235,245,0.3)]">
                    {dir}
                  </span>
                </button>
                <button
                  type="button"
                  title={t('empty.removeRecentFolder')}
                  onClick={() => void removeRecent(dir)}
                  className="mr-2 flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[rgba(235,235,245,0.35)] transition-colors hover:bg-[#FF453A]/15 hover:text-[#FF453A]"
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {clearConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-md">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-recent-title"
            className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1C1C1E] text-left shadow-2xl"
          >
            <div className="flex items-start gap-3.5 border-b border-white/[0.06] px-5 py-4">
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#FF453A]/15 text-[#FF453A]">
                <TrashIcon size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="clear-recent-title" className="text-[15px] font-semibold text-white">
                  {t('empty.clearRecentFoldersTitle')}
                </h2>
                <p className="mt-2 text-[13px] leading-5 text-[rgba(235,235,245,0.62)]">
                  {t('empty.clearRecentFoldersDetail')}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-white/[0.06] bg-[#161618] px-5 py-3">
              <button
                type="button"
                onClick={() => setClearConfirmOpen(false)}
                className="rounded-lg bg-white/[0.06] px-3.5 py-2 text-[13px] font-medium text-[rgba(235,235,245,0.86)] transition-colors hover:bg-white/[0.1]"
              >
                {t('trash.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void clearRecent()}
                className="rounded-lg bg-[#FF453A] px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#ff5b51]"
              >
                {t('empty.clearRecentFoldersConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
