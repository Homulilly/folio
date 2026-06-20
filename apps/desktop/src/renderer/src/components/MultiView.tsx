import { groupSlots, groupStartForIndex } from '@folio/core'
import type { FileProbe, ImageQueueItem, MultiViewLayout } from '@folio/shared-types'
import { useRef, useState } from 'react'
import { useT } from '../i18n'
import { canRenderNatively, displaySrc, formatBytes, formatLabel } from '../lib/format'
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
  rotation,
  onFocus,
  onExpand,
}: {
  item: ImageQueueItem | null
  slot: number
  focused: boolean
  /** Whether zoom applies to this slot (focused, or any slot when sync-zoom is on). */
  active: boolean
  fit: boolean
  zoom: number
  /** Shared rotation applied to every slot; carried into the focused single view. */
  rotation: number
  onFocus: () => void
  /** Double-click: focus this slot and blow it up to the single view (same as Enter). */
  onExpand: () => void
}): React.JSX.Element {
  const t = useT()
  // Slot is remounted (keyed by image id) whenever its image changes, so load state
  // starts fresh and the offscreen <img> unmounts to release its decoded bitmap.
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [reason, setReason] = useState<FileProbe | null>(null)

  if (!item) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-white/[0.08] text-[12px] text-[rgba(235,235,245,0.3)]">
        {t('multi.noMoreImages')}
      </div>
    )
  }

  const renderable = canRenderNatively(item)
  const scaled = active && !fit
  // Focused cell: a soft accent glow on the cell (outside the box, never covered) + a neutral
  // hairline. The accent ring itself is an overlay painted ABOVE the image (see below) so a
  // full-bleed photo can't hide it. Both states inset so focus changes never shift the cell box.
  const ring = focused
    ? 'ring-1 ring-inset ring-white/[0.06] shadow-[0_0_16px_-3px_rgba(10,132,255,0.5)]'
    : 'ring-1 ring-inset ring-white/[0.06]'
  const transform =
    `${rotation ? `rotate(${rotation}deg)` : ''} ${scaled ? `scale(${zoom / 100})` : ''}`.trim() ||
    undefined

  return (
    <button
      type="button"
      onClick={onFocus}
      onDoubleClick={onExpand}
      className={`group relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-black transition-shadow duration-150 ${ring}`}
      style={{ background: 'radial-gradient(circle at 50% 38%, #131315 0%, #000 80%)' }}
    >
      {status === 'error' ? (
        !renderable ? (
          // Non-decodable original AND its sharp preview failed (e.g. JXL) — placeholder.
          <div className="px-4 text-center text-[12px] text-[rgba(235,235,245,0.55)]">
            {t('multi.previewUnavailable', { format: formatLabel(item) })}
          </div>
        ) : (
          <div className="px-4 text-center text-[12px] text-[#FF453A]">
            {t(
              reason === 'missing'
                ? 'multi.fileNotFound'
                : reason === 'unreadable'
                  ? 'multi.fileUnreadable'
                  : 'multi.failedToDecode',
            )}
          </div>
        )
      ) : (
        <>
          {status === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </div>
          )}
          {/* Renderable → original; otherwise the sharp-generated preview so HEIC/TIFF/etc. show. */}
          <img
            key={item.id}
            src={displaySrc(item)}
            alt={item.fileName}
            draggable={false}
            onLoad={() => setStatus('loaded')}
            onError={() => {
              setStatus('error')
              void window.gv.file.probe(item.filePath).then(setReason)
            }}
            className="max-h-full max-w-full object-contain transition-opacity"
            style={{ opacity: status === 'loaded' ? 1 : 0, transform }}
          />
        </>
      )}

      {/* Focus accent ring — layered above the image so a full-bleed photo can't cover it. */}
      {focused && (
        <span className="pointer-events-none absolute inset-0 rounded-lg ring-[1.5px] ring-inset ring-[#0A84FF]/90" />
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
  const expand = useMultiViewStore((s) => s.expand)
  const nextGroup = useMultiViewStore((s) => s.nextGroup)
  const prevGroup = useMultiViewStore((s) => s.prevGroup)
  const fit = useViewerStore((s) => s.fit)
  const zoom = useViewerStore((s) => s.zoom)
  const rotation = useViewerStore((s) => s.rotation)

  const start = groupStartForIndex(currentIndex, mode)
  const slots = groupSlots(items, start, mode)
  const focusedSlot = currentIndex - start
  const { container, slotClass } = LAYOUTS[layout]

  // Wheel over the grid steps whole groups (down → next, up → previous), throttled so a
  // single mouse notch or trackpad flick doesn't fly through many groups at once.
  const lastWheel = useRef(0)
  const onWheel = (e: React.WheelEvent): void => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (Math.abs(delta) < 2 || e.timeStamp - lastWheel.current < 140) return
    lastWheel.current = e.timeStamp
    if (delta > 0) nextGroup()
    else prevGroup()
  }

  return (
    <div className={`grid min-h-0 flex-1 gap-1.5 p-1.5 ${container}`} onWheel={onWheel}>
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
            rotation={rotation}
            onFocus={() => focusSlot(slot)}
            onExpand={() => {
              focusSlot(slot)
              expand()
            }}
          />
        </div>
      ))}
    </div>
  )
}
