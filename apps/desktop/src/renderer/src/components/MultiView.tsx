import { groupSlots, groupStartForIndex, nextGroupStart, viewCountForMode } from '@folio/core'
import type { FileProbe, ImageQueueItem, MultiViewLayout } from '@folio/shared-types'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { canRenderNatively, formatBytes, formatLabel, imageUrl } from '../lib/format'
import { createWheelGate, wheelStep } from '../lib/wheelGesture'
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

/** Delay before warming preloads, so the visible group's loads reach main's sharp queue first
 *  (PRD §9.3 prioritizes the current group over preload). Cancelled if the user steps away sooner. */
const PRELOAD_DEFER_MS = 250

/** Idle gap that marks a discrete wheel gesture (mouse notch / flick from rest) for group stepping.
 *  Set above the trackpad momentum tail's inter-event spacing (~60–95ms while it winds down) but
 *  well under the pause between deliberate swipes, so one flick = one group and re-arming happens
 *  soon after the tail stops. (Measured: events with mag≥4 are ~8ms apart; only the sub-4 tail
 *  stretches to ~95ms.) */
const GROUP_WHEEL_GAP_MS = 140

function Spinner(): React.JSX.Element {
  return (
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-white/70" />
  )
}

function Slot({
  item,
  slot,
  focused,
  fit,
  zoom,
  rotation,
  onFocus,
  onExpand,
}: {
  item: ImageQueueItem | null
  slot: number
  focused: boolean
  /** This slot's own fit/zoom (independent per slot unless sync-zoom is on). */
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
  // Which variant this cell loads. Large rasters (and non-decodable formats) use the cheaper sharp
  // preview, so a group of big images doesn't decode several full-res originals at once; small
  // rasters and svg/ico use the original. null = still measuring (a quick dimensions probe).
  const [variant, setVariant] = useState<'original' | 'preview' | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the slot's image changes
  useEffect(() => {
    if (!item) return
    if (!canRenderNatively(item)) {
      setVariant('preview') // HEIC/TIFF/… can't decode the original in an <img>
      return
    }
    let cancelled = false
    setVariant(null)
    window.gv.image
      .dimensions(item.filePath)
      .then((d) => {
        if (cancelled) return
        // Only swap a true raster to preview; svg/ico (no sniffed format) stay on the original.
        const large = d != null && (d.width > 2048 || d.height > 2048) && item.format != null
        setVariant(large ? 'preview' : 'original')
      })
      .catch(() => {
        if (!cancelled) setVariant('original')
      })
    return () => {
      cancelled = true
    }
  }, [item?.filePath])

  if (!item) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-white/[0.08] text-[12px] text-[rgba(235,235,245,0.3)]">
        {t('multi.noMoreImages')}
      </div>
    )
  }

  const renderable = canRenderNatively(item)
  const scaled = !fit
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
          {(status === 'loading' || variant === null) && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </div>
          )}
          {/* Big rasters load the sharp preview (bounds grid memory); small rasters & non-decodable
              formats resolve in the effect above. Waits for the variant decision before loading. */}
          {variant !== null && (
            <img
              key={item.id}
              src={imageUrl(variant, item.filePath)}
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
          )}
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

/** The multi-image grid. Renders only the current group's cells (big rasters via the lightweight
 *  preview); offscreen groups unmount, so the browser releases their decoded bitmaps and memory
 *  stays flat. */
export function MultiView(): React.JSX.Element {
  const items = useQueueStore((s) => s.items)
  const currentIndex = useQueueStore((s) => s.currentIndex)
  const mode = useMultiViewStore((s) => s.mode)
  const layout = useMultiViewStore((s) => s.layout)
  const syncZoom = useMultiViewStore((s) => s.syncZoom)
  const zoomMemory = useMultiViewStore((s) => s.zoomMemory)
  const focusSlot = useMultiViewStore((s) => s.focusSlot)
  const expand = useMultiViewStore((s) => s.expand)
  const nextGroup = useMultiViewStore((s) => s.nextGroup)
  const prevGroup = useMultiViewStore((s) => s.prevGroup)
  const preloadGroups = useMultiViewStore((s) => s.preloadGroups)
  const loopEnabled = useMultiViewStore((s) => s.loopEnabled)
  const fit = useViewerStore((s) => s.fit)
  const zoom = useViewerStore((s) => s.zoom)
  const rotation = useViewerStore((s) => s.rotation)

  const start = groupStartForIndex(currentIndex, mode)
  const slots = groupSlots(items, start, mode)
  const focusedSlot = currentIndex - start
  const focusedId = items[currentIndex]?.id ?? null
  const { container, slotClass } = LAYOUTS[layout]

  // Per-slot zoom: when sync-zoom is off, each slot keeps its own zoom. The live viewer store holds
  // the *focused* slot's zoom; on focus change we stash the outgoing slot's zoom (by image id) and
  // restore the incoming slot's (or fit, if it has none). useLayoutEffect runs before paint so the
  // swap is flash-free. Sync-zoom keeps the shared live zoom across focus changes (comparison mode).
  const prevFocusedId = useRef(focusedId)
  useLayoutEffect(() => {
    const prev = prevFocusedId.current
    if (prev === focusedId) return
    prevFocusedId.current = focusedId
    if (useMultiViewStore.getState().syncZoom) return
    const v = useViewerStore.getState()
    if (prev !== null) useMultiViewStore.getState().rememberZoom(prev, { fit: v.fit, zoom: v.zoom })
    const mem = focusedId !== null ? useMultiViewStore.getState().zoomMemory[focusedId] : undefined
    v.restore(mem?.fit ?? true, mem?.zoom ?? 100)
  }, [focusedId])

  // Warm the next group(s) so stepping forward is instant: each gv-img request makes main generate
  // and disk-cache the preview (the costly part), and Chromium serves the live resource from its
  // in-memory cache when the real Slot mounts. Opt-in (Settings → Browsing, 1 or 2 groups). Held in
  // a ref (replaced each navigation) so only the current preload set's bitmaps live at once; the
  // deferred timer + cancel flag keep preloads from stealing decode slots from the visible group and
  // drop stale work when the user steps quickly. Re-runs only on group/queue change (start/items),
  // not intra-group focus changes (start is group-aligned).
  const preloadRefs = useRef<HTMLImageElement[]>([])
  useEffect(() => {
    preloadRefs.current = []
    if (preloadGroups <= 0 || items.length === 0) return
    const step = viewCountForMode(mode)
    const total = items.length
    // Items filling the next `preloadGroups` groups (forward, wrapping when loop is on).
    const candidates: ImageQueueItem[] = []
    const seen = new Set<number>([start])
    let s = start
    for (let g = 0; g < preloadGroups; g++) {
      const ns = nextGroupStart({ startIndex: s, mode, total, loop: loopEnabled })
      if (ns === s || seen.has(ns)) break // clamped at the end, or wrapped back to a seen group
      seen.add(ns)
      s = ns
      for (let i = 0; i < step; i++) {
        const it = items[ns + i]
        if (it) candidates.push(it)
      }
    }
    if (candidates.length === 0) return

    let cancelled = false
    const warm = (src: string): void => {
      if (cancelled) return
      const img = new Image()
      img.src = src // a preview that can't be generated (e.g. JXL) just fails silently — harmless
      preloadRefs.current.push(img)
    }
    const timer = window.setTimeout(() => {
      for (const it of candidates) {
        // Mirror the Slot's variant choice so the warmed URL matches what it will mount: big rasters
        // (and non-decodable formats) use the lightweight preview; small rasters & svg/ico use the
        // original. Non-decodable formats skip the dimensions probe (always preview).
        if (!canRenderNatively(it)) {
          warm(imageUrl('preview', it.filePath))
          continue
        }
        void window.gv.image
          .dimensions(it.filePath)
          .then((d) => {
            const large = d != null && (d.width > 2048 || d.height > 2048) && it.format != null
            warm(imageUrl(large ? 'preview' : 'original', it.filePath))
          })
          .catch(() => warm(imageUrl('original', it.filePath)))
      }
    }, PRELOAD_DEFER_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      // Abort any in-flight gv-img requests so stale preloads stop sitting ahead of the newly
      // visible group in main's FIFO variant queue. Best-effort: this cancels the renderer-side
      // request; a sharp job main already dispatched may still finish, but its result just lands in
      // the disk cache (not wasted). Full priority/cancellation in the main queue is a later change.
      for (const img of preloadRefs.current) img.src = ''
      preloadRefs.current = []
    }
  }, [start, mode, preloadGroups, loopEnabled, items])

  // Wheel over the grid steps whole groups (down/right → next, up/left → previous). The gate makes a
  // continuous trackpad flick advance just one group (one gesture = one step); discrete mouse notches
  // still step individually. See lib/wheelGesture.
  const wheelGate = useRef(createWheelGate())
  const onWheel = (e: React.WheelEvent): void => {
    const step = wheelStep(wheelGate.current, e, GROUP_WHEEL_GAP_MS)
    if (step > 0) nextGroup()
    else if (step < 0) prevGroup()
  }

  return (
    <div className={`grid min-h-0 flex-1 gap-1.5 p-1.5 ${container}`} onWheel={onWheel}>
      {slots.map((item, slot) => {
        const isFocused = slot === focusedSlot
        // Focused slot (and every slot under sync-zoom) uses the live viewer zoom; other slots use
        // their own remembered zoom, defaulting to fit.
        const mem = item ? zoomMemory[item.id] : undefined
        const useLive = isFocused || syncZoom
        const slotFit = useLive ? fit : (mem?.fit ?? true)
        const slotZoom = useLive ? zoom : (mem?.zoom ?? 100)
        return (
          <div
            key={item ? item.id : `blank-${slot}`}
            className={`min-h-0 min-w-0 ${slotClass?.(slot) ?? ''}`}
          >
            <Slot
              item={item}
              slot={slot}
              focused={isFocused}
              fit={slotFit}
              zoom={slotZoom}
              rotation={rotation}
              onFocus={() => focusSlot(slot)}
              onExpand={() => {
                focusSlot(slot)
                expand()
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
