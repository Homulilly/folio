import { useEffect, useRef } from 'react'
import { formatBytes, formatLabel } from '../lib/format'
import { useQueueStore } from '../stores/queueStore'

export function QueueRail(): React.JSX.Element {
  const items = useQueueStore((s) => s.items)
  const currentIndex = useQueueStore((s) => s.currentIndex)
  const select = useQueueStore((s) => s.select)
  const activeRef = useRef<HTMLButtonElement>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll the row into view when selection changes
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [currentIndex])

  return (
    <div className="flex w-72 flex-none flex-col border-r border-white/[0.06] bg-[#161618]">
      <div className="flex h-10 flex-none items-center justify-between border-b border-white/[0.06] px-3.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-[rgba(235,235,245,0.6)]">
          Queue
        </span>
        <span className="font-mono text-[11px] text-[rgba(235,235,245,0.3)]">
          {items.length} images
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5">
        {items.map((it, i) => {
          const selected = i === currentIndex
          return (
            <button
              type="button"
              key={it.id}
              ref={selected ? activeRef : null}
              onClick={() => select(i)}
              className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ${
                selected
                  ? 'bg-[#0A84FF]/20 ring-1 ring-inset ring-[#0A84FF]/40'
                  : 'hover:bg-white/[0.04]'
              }`}
            >
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-white/[0.06] font-mono text-[9px] font-bold text-[rgba(235,235,245,0.6)]">
                {it.ext.toUpperCase().slice(0, 4)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className={`truncate text-[13px] ${selected ? 'text-white' : 'text-[rgba(235,235,245,0.85)]'}`}
                >
                  {it.fileName}
                </span>
                <span className="truncate font-mono text-[11px] text-[rgba(235,235,245,0.3)]">
                  {formatBytes(it.size)} · {formatLabel(it.ext)}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
