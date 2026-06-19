import { useEffect, useState } from 'react'
import { useTrashConfirmStore } from '../stores/trashConfirmStore'
import { TrashIcon } from './icons'

export function TrashConfirmDialog(): React.JSX.Element | null {
  const request = useTrashConfirmStore((s) => s.request)
  const accept = useTrashConfirmStore((s) => s.accept)
  const cancel = useTrashConfirmStore((s) => s.cancel)
  const [skipUntilRestart, setSkipUntilRestart] = useState(false)

  useEffect(() => {
    if (!request) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setSkipUntilRestart(false)
        cancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [request, cancel])

  if (!request) return null

  const close = (): void => {
    setSkipUntilRestart(false)
    cancel()
  }

  const confirm = (): void => {
    accept(skipUntilRestart)
    setSkipUntilRestart(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="trash-confirm-title"
        className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1C1C1E] shadow-2xl"
      >
        <div className="flex items-start gap-3.5 border-b border-white/[0.06] px-5 py-4">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#FF453A]/15 text-[#FF453A]">
            <TrashIcon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="trash-confirm-title" className="text-[15px] font-semibold text-white">
              Move image to Trash?
            </h2>
            <p className="mt-1 truncate font-mono text-[12px] text-[rgba(235,235,245,0.55)]">
              {request.fileName}
            </p>
          </div>
        </div>

        <div className="px-5 py-4">
          <p className="text-[13px] leading-5 text-[rgba(235,235,245,0.65)]">
            The file will be removed from the queue and moved to the system Trash.
          </p>
          <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-[13px] text-[rgba(235,235,245,0.78)]">
            <input
              type="checkbox"
              checked={skipUntilRestart}
              onChange={(e) => setSkipUntilRestart(e.currentTarget.checked)}
              className="sr-only"
            />
            <span
              className={`flex h-4 w-4 flex-none items-center justify-center rounded border transition-colors ${
                skipUntilRestart
                  ? 'border-[#0A84FF] bg-[#0A84FF]'
                  : 'border-white/20 bg-white/[0.04]'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full bg-white transition-opacity ${
                  skipUntilRestart ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </span>
            <span>Don&apos;t ask again until Folio restarts</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/[0.06] bg-[#161618] px-5 py-3">
          <button
            type="button"
            onClick={close}
            className="rounded-lg bg-white/[0.06] px-3.5 py-2 text-[13px] font-medium text-[rgba(235,235,245,0.86)] transition-colors hover:bg-white/[0.1]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            className="rounded-lg bg-[#FF453A] px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#ff5b51]"
          >
            Move to Trash
          </button>
        </div>
      </div>
    </div>
  )
}
