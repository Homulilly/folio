import { groupSlots, groupStartForIndex } from '@folio/core'
import type { ImageQueueItem, MultiViewLayout } from '@folio/shared-types'
import { useState } from 'react'
import { canRenderNatively, formatBytes, formatLabel, imageUrl } from '../lib/format'
import { useMultiViewStore } from '../stores/multiViewStore'
import { useQueueStore } from '../stores/queueStore'
import { useViewerStore } from '../stores/viewerStore'

/** Tailwind grid template + per-slot span rules for each layout. */
const LAYOUTS: Record<
  MultiViewLayout,
  { container: string; slotClass?: (slot: number) => string }
> = {
  single: { container: 'grid-cols-1 grid-rows-1' },
  dual_horizontal: { container: 'grid-cols-2 grid-rows-1' },
  dual_vertical: { container: 'grid-cols-1 grid-rows-2' },
  // Left image spans both rows; the other two stack on the right.
  triple_main_left: {
    container: 'grid-cols-2 grid-rows-2',
    slotClass: (slot) => (slot === 0 ? 'row-span-2' : ''),
  },
  triple_equal_columns: { container: 'grid-cols-3 grid-rows-1' },
  quad_grid: { container: 'grid-cols-2 grid-rows-2' },
}

function Spinner(): React.JSX.Element {
  return (
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-white/70" />
  )
}

function Slot({
  item,
  slot,
  focused,
  active,
  fit,
  zoom,
  onFocus,
}: {
  item: ImageQueueItem | null
  slot: number
  focused: boolean
  /** Whether zoom applies to this slot (focused, or any slot when sync-zoom is on). */
  active: boolean
  fit: boolean
  zoom: number
  onFocus: () => void
}): React.JSX.Element {
  // Slot is remounted (keyed by image id) whenever its image changes, so load state
  // starts fresh and the offscreen <img> unmounts to release its decoded bitmap.
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')

  if (!item) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-white/[0.08] text-[12px] text-[rgba(235,235,245,0.3)]">
        No more images
      </div>
    )
  }

  const renderable = canRenderNatively(item)
  const scaled = active && !fit
  const ring = focused ? 'ring-2 ring-[#0A84FF]' : 'ring-1 ring-white/[0.06]'

  return (
    <button
      type="button"
      onClick={onFocus}
      className={`group relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-black ${ring}`}
      style={{ background: 'radial-gradient(circle at 50% 38%, #131315 0%, #000 80%)' }}
    >
      {!renderable ? (
        <div className="px-4 text-center text-[12px] text-[rgba(235,235,245,0.55)]">
          {formatLabel(item)} preview not available yet
        </div>
      ) : status === 'error' ? (
        <div className="px-4 text-center text-[12px] text-[#FF453A]">Failed to decode</div>
      ) : (
        <>
          {status === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </div>
          )}
          <img
            key={item.id}
            src={imageUrl('original', item.filePath)}
            alt={item.fileName}
            draggable={false}
            onLoad={() => setStatus('loaded')}
            onError={() => setStatus('error')}
            className="max-h-full max-w-full object-contain transition-opacity"
            style={{
              opacity: status === 'loaded' ? 1 : 0,
              transform: scaled ? `scale(${zoom / 100})` : undefined,
            }}
          />
        </>
      )}

      <span className="pointer-events-none absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-md bg-black/55 font-mono text-[10px] text-white/80 backdrop-blur">
        {slot + 1}
      </span>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-1.5 pt-4 font-mono text-[11px] text-white/85">
        <span className="truncate">{item.fileName}</span>
        <span className="ml-auto flex-none text-white/55">
          {formatLabel(item)} · {formatBytes(item.size)}
        </span>
      </div>
    </button>
  )
}

/** The multi-image grid. Renders only the current group's originals — offscreen images
 *  unmount, so the browser releases their decoded bitmaps and memory stays flat. */
export function MultiView(): React.JSX.Element {
  const items = useQueueStore((s) => s.items)
  const currentIndex = useQueueStore((s) => s.currentIndex)
  const mode = useMultiViewStore((s) => s.mode)
  const layout = useMultiViewStore((s) => s.layout)
  const syncZoom = useMultiViewStore((s) => s.syncZoom)
  const focusSlot = useMultiViewStore((s) => s.focusSlot)
  const fit = useViewerStore((s) => s.fit)
  const zoom = useViewerStore((s) => s.zoom)

  const start = groupStartForIndex(currentIndex, mode)
  const slots = groupSlots(items, start, mode)
  const focusedSlot = currentIndex - start
  const { container, slotClass } = LAYOUTS[layout]

  return (
    <div className={`grid min-h-0 flex-1 gap-1.5 p-1.5 ${container}`}>
      {slots.map((item, slot) => (
        <div
          key={item ? item.id : `blank-${slot}`}
          className={`min-h-0 min-w-0 ${slotClass?.(slot) ?? ''}`}
        >
          <Slot
            item={item}
            slot={slot}
            focused={slot === focusedSlot}
            active={slot === focusedSlot || syncZoom}
            fit={fit}
            zoom={zoom}
            onFocus={() => focusSlot(slot)}
          />
        </div>
      ))}
    </div>
  )
}
