import { useEffect, useState } from 'react'
import { openFile, openFolder, openPaths } from '../lib/actions'
import { FolderIcon, ImageIcon } from './icons'

function basename(p: string): string {
  return p.split('/').filter(Boolean).pop() ?? p
}

export function EmptyState(): React.JSX.Element {
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    void window.gv.recent.list().then(setRecent)
  }, [])

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center"
      style={{ background: 'radial-gradient(circle at 50% 38%, #131315 0%, #000 78%)' }}
    >
      <div>
        <div className="text-2xl font-semibold tracking-tight">No images open</div>
        <div className="mt-2 text-sm text-[rgba(235,235,245,0.5)]">
          Open a folder or drag images here to start browsing.
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={openFolder}
          className="flex items-center gap-2 rounded-xl bg-[#0A84FF] px-4 py-2.5 text-sm font-semibold text-white"
        >
          <FolderIcon size={17} />
          Open Folder
        </button>
        <button
          type="button"
          onClick={openFile}
          className="flex items-center gap-2 rounded-xl bg-[#2C2C2E] px-4 py-2.5 text-sm font-semibold text-[rgba(235,235,245,0.85)]"
        >
          <ImageIcon size={17} />
          Open File
        </button>
      </div>

      {recent.length > 0 && (
        <div className="w-full max-w-md">
          <div className="mb-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[rgba(235,235,245,0.4)]">
            Recent folders
          </div>
          <div className="overflow-hidden rounded-xl bg-[#1C1C1E]">
            {recent.slice(0, 6).map((dir) => (
              <button
                type="button"
                key={dir}
                onClick={() => openPaths([dir])}
                title={dir}
                className="flex w-full items-center gap-2.5 border-b border-[rgba(84,84,88,0.4)] px-3.5 py-2.5 text-left last:border-b-0 hover:bg-white/[0.04]"
              >
                <FolderIcon size={15} className="flex-none text-[rgba(235,235,245,0.5)]" />
                <span className="truncate text-[13px] text-[rgba(235,235,245,0.85)]">
                  {basename(dir)}
                </span>
                <span className="ml-auto truncate font-mono text-[11px] text-[rgba(235,235,245,0.3)]">
                  {dir}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
