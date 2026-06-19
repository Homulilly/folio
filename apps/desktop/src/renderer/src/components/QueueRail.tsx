import { groupStartForIndex, viewCountForMode } from '@folio/core'
import { useEffect, useRef } from 'react'
import { useT } from '../i18n'
import { formatBytes, formatLabel } from '../lib/format'
import { useMultiViewStore } from '../stores/multiViewStore'
import { useQueueStore } from '../stores/queueStore'
import { ScrollOverlay } from './ScrollOverlay'

export function QueueRail(): React.JSX.Element {
  const t = useT()
  const items = useQueueStore((s) => s.items)
  const currentIndex = useQueueStore((s) => s.currentIndex)
  const select = useQueueStore((s) => s.select)
  const mode = useMultiViewStore((s) => s.mode)
  const activeRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Range of indices in the currently displayed group (so multi-view shows which rows are on screen).
  const groupStart = groupStartForIndex(currentIndex, mode)
  const groupEnd = groupStart + viewCountForMode(mode)

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll the row into view when selection changes
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [currentIndex])

  return (
    <div className="flex w-72 flex-none flex-col border-r border-white/[0.06] bg-[#161618]">
      <div className="flex h-10 flex-none items-center justify-between border-b border-white/[0.06] px-3.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-[rgba(235,235,245,0.6)]">
          {t('queue.title')}
        </span>
        <span className="font-mono text-[11px] text-[rgba(235,235,245,0.3)]">
          {t('queue.images', { count: items.length })}
        </span>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={listRef} className="no-scrollbar absolute inset-0 overflow-y-auto p-1.5">
          <div>
            {items.map((it, i) => {
              const selected = i === currentIndex
              const inGroup = mode !== 'single' && i >= groupStart && i < groupEnd
              return (
                <button
                  type="button"
                  key={it.id}
                  ref={selected ? activeRef : null}
                  onClick={() => select(i)}
                  className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ${
                    selected
                      ? 'bg-[#0A84FF]/20 ring-1 ring-inset ring-[#0A84FF]/40'
                      : inGroup
                        ? 'bg-white/[0.06] ring-1 ring-inset ring-white/10'
                        : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-white/[0.06] font-mono text-[9px] font-bold text-[rgba(235,235,245,0.6)]">
                    {formatLabel(it).toUpperCase().slice(0, 4)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className={`truncate text-[13px] ${selected ? 'text-white' : 'text-[rgba(235,235,245,0.85)]'}`}
                    >
                      {it.fileName}
                    </span>
                    <span className="truncate font-mono text-[11px] text-[rgba(235,235,245,0.3)]">
                      {formatBytes(it.size)} · {formatLabel(it)}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <ScrollOverlay scrollRef={listRef} />
      </div>
    </div>
  )
}
