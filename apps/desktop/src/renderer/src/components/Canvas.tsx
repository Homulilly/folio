import type { FileProbe } from '@folio/shared-types'
import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { canRenderNatively, displaySrc, formatLabel, imageUrl } from '../lib/format'
import { useMultiViewStore } from '../stores/multiViewStore'
import { useQueueStore } from '../stores/queueStore'
import { useViewerStore } from '../stores/viewerStore'
import { ChevronLeft, ChevronRight, ShrinkIcon } from './icons'
import { ScrollOverlay } from './ScrollOverlay'

const WHEEL_LINE_DELTA_PX = 16
const WHEEL_PAGE_DELTA_PX = 120
const WHEEL_ZOOM_SENSITIVITY = 0.002
const WHEEL_ZOOM_ANIMATION_MS = 70
const BUTTON_ZOOM_ANIMATION_MS = 140
const WHEEL_ANCHOR_TTL_MS = 240
const ZOOM_EPSILON = 0.0005

interface ZoomAnchor {
  x: number
  y: number
  pointerX: number
  pointerY: number
}

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3

/**
 * Anchor that keeps the canvas viewport's centre fixed during a zoom — used for button/keyboard
 * zoom, which (unlike the wheel) has no pointer to pin. Computed from the pre-zoom geometry: the
 * image fraction currently under the viewport centre, plus that centre in client coords.
 */
function viewportCenterAnchor(el: HTMLDivElement | null): ZoomAnchor | null {
  if (!el) return null
  const img = el.querySelector<HTMLImageElement>('img')
  if (!img) return null
  const before = img.getBoundingClientRect()
  if (before.width <= 0 || before.height <= 0) return null
  const view = el.getBoundingClientRect()
  const pointerX = view.left + view.width / 2
  const pointerY = view.top + view.height / 2
  return {
    x: Math.max(0, Math.min(1, (pointerX - before.left) / before.width)),
    y: Math.max(0, Math.min(1, (pointerY - before.top) / before.height)),
    pointerX,
    pointerY,
  }
}

export function Canvas(): React.JSX.Element {
  const t = useT()
  const item = useQueueStore((s) => s.items[s.currentIndex])
  const currentIndex = useQueueStore((s) => s.currentIndex)
  const total = useQueueStore((s) => s.items.length)
  const itemId = item?.id ?? null
  const hasItem = itemId !== null
  const expanded = useMultiViewStore((s) => s.expanded)
  const collapse = useMultiViewStore((s) => s.collapse)
  const loopEnabled = useMultiViewStore((s) => s.loopEnabled)
  const prevGroup = useMultiViewStore((s) => s.prevGroup)
  const nextGroup = useMultiViewStore((s) => s.nextGroup)
  const fit = useViewerStore((s) => s.fit)
  const zoom = useViewerStore((s) => s.zoom)
  const fitWindow = useViewerStore((s) => s.fitWindow)
  const rotation = useViewerStore((s) => s.rotation)
  const naturalWidth = useViewerStore((s) => s.naturalWidth)
  const naturalHeight = useViewerStore((s) => s.naturalHeight)
  const viewportWidth = useViewerStore((s) => s.viewportWidth)
  const viewportHeight = useViewerStore((s) => s.viewportHeight)
  const setNatural = useViewerStore((s) => s.setNatural)

  const [failed, setFailed] = useState(false)
  const [failReason, setFailReason] = useState<FileProbe | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const zoomRaf = useRef<number | null>(null)
  const zoomAnimationRaf = useRef<number | null>(null)
  const wheelDelta = useRef(0)
  const activeZoomAnchor = useRef<ZoomAnchor | null>(null)
  const clearZoomAnchorTimer = useRef<number | null>(null)
  const lastWheelZoomAt = useRef(0)
  const scaleReady = useRef(false)
  // The live, possibly-mid-animation scale. Single source of truth: the rAF loop writes it
  // (and the DOM) directly, and the render reads it — so a re-render during a zoom animation
  // re-applies the same value rather than fighting the in-flight DOM mutation.
  const displayScaleRef = useRef(1)

  // biome-ignore lint/correctness/useExhaustiveDependencies: setters are stable; reset on image change
  useEffect(() => {
    setFailed(false)
    setFailReason(null)
  }, [itemId])

  // Non-decodable formats display the downscaled preview, whose <img> size isn't the real size —
  // fetch the true source dimensions (cheap header read in main) so fit / zoom % / status-bar
  // dimensions stay correct. Decodable formats load the original, which reports true dims via onLoad.
  // biome-ignore lint/correctness/useExhaustiveDependencies: setNatural is stable; refetch on image change
  useEffect(() => {
    if (!item || canRenderNatively(item)) return
    let cancelled = false
    void window.gv.image.dimensions(item.filePath).then((d) => {
      if (!cancelled && d) setNatural(d.width, d.height)
    })
    return () => {
      cancelled = true
    }
  }, [itemId])

  // Warm the next/prev images so single-view navigation is instant: Chromium serves the live
  // resource from its in-memory cache when the real <img> mounts with the same URL. Hold at most
  // two Image() refs (replaced each navigation), so only two extra decoded bitmaps live at once —
  // bounded memory, in line with the multi-view decode limit (architecture rule §6).
  const preloadRefs = useRef<HTMLImageElement[]>([])
  useEffect(() => {
    const { items } = useQueueStore.getState()
    const neighbors = [items[currentIndex + 1], items[currentIndex - 1]].filter(
      (it): it is NonNullable<typeof it> => it != null,
    )
    preloadRefs.current = neighbors.map((it) => {
      const img = new Image()
      img.src = displaySrc(it)
      return img
    })
  }, [currentIndex])

  // On load failure, ask main *why* (the <img> error gives no reason) so we can distinguish a
  // missing/unreadable file from a genuine decode failure. Ignore a stale result if the user
  // has already navigated to another image.
  const onImageError = (): void => {
    setFailed(true)
    setFailReason(null)
    if (!item) return
    const id = item.id
    void window.gv.file.probe(item.filePath).then((reason) => {
      const q = useQueueStore.getState()
      if (q.items[q.currentIndex]?.id === id) setFailReason(reason)
    })
  }

  // Mouse wheel zooms the image. A native, non-passive listener is required because React's
  // onWheel is passive, so preventDefault() there can't stop the canvas from scrolling. Canvas
  // tracks the viewport size so the store can resume zoom from the actual fit scale.
  useEffect(() => {
    if (!hasItem) return
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      const unit =
        e.deltaMode === 1 ? WHEEL_LINE_DELTA_PX : e.deltaMode === 2 ? WHEEL_PAGE_DELTA_PX : 1
      const img = el.querySelector<HTMLImageElement>('img')
      const before = img?.getBoundingClientRect()
      const pointer = { x: e.clientX, y: e.clientY }
      const anchor =
        before && before.width > 0 && before.height > 0
          ? {
              x: Math.max(0, Math.min(1, (pointer.x - before.left) / before.width)),
              y: Math.max(0, Math.min(1, (pointer.y - before.top) / before.height)),
            }
          : null

      wheelDelta.current += e.deltaY * unit
      activeZoomAnchor.current = anchor
        ? {
            ...anchor,
            pointerX: pointer.x,
            pointerY: pointer.y,
          }
        : null
      if (clearZoomAnchorTimer.current) window.clearTimeout(clearZoomAnchorTimer.current)
      clearZoomAnchorTimer.current = window.setTimeout(() => {
        activeZoomAnchor.current = null
        clearZoomAnchorTimer.current = null
      }, WHEEL_ANCHOR_TTL_MS)

      if (zoomRaf.current) return
      zoomRaf.current = requestAnimationFrame(() => {
        const pendingDelta = wheelDelta.current
        wheelDelta.current = 0
        zoomRaf.current = null

        if (pendingDelta === 0) return
        lastWheelZoomAt.current = performance.now()
        useViewerStore.getState().zoomByFactor(Math.exp(-pendingDelta * WHEEL_ZOOM_SENSITIVITY))
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    const ro = new ResizeObserver(() => {
      useViewerStore.getState().setViewport(el.clientWidth, el.clientHeight)
    })
    ro.observe(el)
    return () => {
      el.removeEventListener('wheel', onWheel)
      if (zoomRaf.current) cancelAnimationFrame(zoomRaf.current)
      if (zoomAnimationRaf.current) cancelAnimationFrame(zoomAnimationRaf.current)
      if (clearZoomAnchorTimer.current) window.clearTimeout(clearZoomAnchorTimer.current)
      ro.disconnect()
    }
  }, [hasItem])

  const renderable = item ? canRenderNatively(item) : false
  const transform = `rotate(${rotation}deg)`
  const canPan = !fit
  // Drag-out is only the "pick up the file" gesture while the image fully fits; once zoomed,
  // dragging pans instead (see docs/file-drag-out.md). gv-img:// is never the drag payload.
  const canDragOut = fit && renderable && !failed
  // Hover-reveal nav arrows; hidden at the ends unless looping.
  const showPrev = loopEnabled || currentIndex > 0
  const showNext = loopEnabled || currentIndex < total - 1

  // Resolve the displayed pixel size from natural + viewport so BOTH dimensions are
  // honoured. Fit scales the image down to fit inside the viewport (never upscaling); zoom
  // is an explicit percentage. Rotation by 90/270 swaps which natural side bounds each axis.
  // Falls back to CSS object-contain until natural/viewport sizes are known.
  const rotated = rotation === 90 || rotation === 270
  const sizable = naturalWidth && naturalHeight && (!fit || (viewportWidth && viewportHeight))
  let targetScale: number | null = null
  if (naturalWidth && naturalHeight && sizable) {
    const boundW = rotated ? naturalHeight : naturalWidth
    const boundH = rotated ? naturalWidth : naturalHeight
    targetScale = fit
      ? Math.min((viewportWidth as number) / boundW, (viewportHeight as number) / boundH, 1)
      : zoom / 100
  }

  // Single view always loads the full original for decodable formats (full quality, no
  // preview-substitution); only formats the browser can't decode (HEIC/TIFF/…) fall back to the
  // sharp-generated preview. The large-image preview optimisation is reserved for multi-view.
  const variant: 'original' | 'preview' = renderable ? 'original' : 'preview'

  useEffect(() => {
    if (!itemId) return
    scaleReady.current = false
    displayScaleRef.current = 1
  }, [itemId])

  // Animate the displayed scale toward targetScale by mutating the <img> (and anchor scroll)
  // directly inside the rAF loop — no per-frame setState, so React doesn't reconcile the whole
  // canvas subtree 60×/s. The render reads displayScaleRef, so any re-render mid-animation
  // (e.g. continuous wheeling) just re-applies the live value instead of snapping back.
  useEffect(() => {
    if (targetScale === null) return

    const el = scrollRef.current

    const apply = (s: number, anchor: ZoomAnchor | null): void => {
      displayScaleRef.current = s
      if (!el || naturalWidth == null || naturalHeight == null) return
      const img = el.querySelector<HTMLImageElement>('img')
      if (!img) return
      img.style.width = `${naturalWidth * s}px`
      img.style.height = `${naturalHeight * s}px`
      // Reading the rect forces the just-set size to lay out, then we keep the anchor point
      // pinned in the viewport — one reflow per frame, co-located with the resize.
      if (anchor) {
        const after = img.getBoundingClientRect()
        el.scrollLeft += after.left + after.width * anchor.x - anchor.pointerX
        el.scrollTop += after.top + after.height * anchor.y - anchor.pointerY
      }
    }

    if (!scaleReady.current) {
      // First scale for this image — snap, don't animate (the render already used targetScale).
      scaleReady.current = true
      displayScaleRef.current = targetScale
      return
    }

    if (zoomAnimationRaf.current) cancelAnimationFrame(zoomAnimationRaf.current)

    const from = displayScaleRef.current
    const to = targetScale
    // Wheel zoom pins the point under the cursor; button/keyboard zoom has none, so fall back
    // to the viewport centre. Captured once from the pre-zoom geometry and held for the run.
    const anchor = activeZoomAnchor.current ?? viewportCenterAnchor(el)
    if (Math.abs(from - to) < ZOOM_EPSILON) {
      apply(to, anchor)
      return
    }

    const start = performance.now()
    const duration =
      start - lastWheelZoomAt.current < WHEEL_ANCHOR_TTL_MS
        ? WHEEL_ZOOM_ANIMATION_MS
        : BUTTON_ZOOM_ANIMATION_MS

    const animate = (now: number): void => {
      const progress = Math.min(1, (now - start) / duration)
      apply(from + (to - from) * easeOutCubic(progress), anchor)

      if (progress < 1) {
        zoomAnimationRaf.current = requestAnimationFrame(animate)
        return
      }

      apply(to, anchor)
      zoomAnimationRaf.current = null
    }

    zoomAnimationRaf.current = requestAnimationFrame(animate)

    return () => {
      if (zoomAnimationRaf.current) {
        cancelAnimationFrame(zoomAnimationRaf.current)
        zoomAnimationRaf.current = null
      }
    }
  }, [targetScale, naturalWidth, naturalHeight])

  let imgClassName = 'max-h-full max-w-full object-contain'
  let imgStyle: React.CSSProperties = { transform }
  if (naturalWidth && naturalHeight && targetScale !== null) {
    const scale = scaleReady.current ? displayScaleRef.current : targetScale
    imgClassName = 'flex-none object-contain'
    imgStyle = {
      width: naturalWidth * scale,
      height: naturalHeight * scale,
      maxWidth: 'none',
      transform,
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!canPan || !scrollRef.current) return
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      left: scrollRef.current.scrollLeft,
      top: scrollRef.current.scrollTop,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !scrollRef.current) return
    scrollRef.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x)
    scrollRef.current.scrollTop = drag.current.top - (e.clientY - drag.current.y)
  }
  const endDrag = () => {
    drag.current = null
  }
  const onImageDragStart = (e: React.DragEvent<HTMLImageElement>) => {
    if (!canDragOut || !item) return
    // Hand the real file path to main, which owns the OS drag session; suppress the DOM drag.
    e.dataTransfer.clearData()
    e.dataTransfer.effectAllowed = 'copy'
    window.gv.file.startDrag(item.filePath)
    e.preventDefault()
    e.stopPropagation()
  }
  // Double-click on the image: zoomed → snap back to Fit; already at Fit but expanded from the
  // grid → return to the grid (mirrors Enter). At Fit in plain single mode it's a no-op.
  const onDoubleClick = () => {
    if (!fit) fitWindow()
    else if (expanded) collapse()
  }

  if (!item) return <div className="flex-1" />

  return (
    // Fixed positioning context: holds the background and the overlays so they never move
    // with the (scrolling) image. overflow-hidden + min-w/h-0 keep a zoomed image from
    // expanding the layout and scrolling the toolbar/queue rail.
    <div
      className="relative min-h-0 min-w-0 flex-1 overflow-hidden"
      style={{ background: 'radial-gradient(circle at 50% 38%, #131315 0%, #000 78%)' }}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: image pan/zoom surface; keyboard has Space/+/- /Enter equivalents */}
      <div
        ref={scrollRef}
        className={`no-scrollbar absolute inset-0 overflow-auto ${canPan || canDragOut ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={onDoubleClick}
      >
        {/* At least viewport-sized so a small image stays centered; grows to a zoomed image so
            it scrolls (and pans) on both axes from the top-left, not from a clipped centre. */}
        <div className="flex min-h-full min-w-full items-center justify-center">
          {failed ? (
            !renderable ? (
              // Non-decodable original AND its sharp preview failed (e.g. JXL) — placeholder.
              <div className="max-w-sm px-6 text-center">
                <div className="text-base font-medium text-[rgba(235,235,245,0.85)]">
                  {t('canvas.previewUnavailable', { format: formatLabel(item) })}
                </div>
                <div className="mt-2 text-[13px] text-[rgba(235,235,245,0.45)]">
                  {t('canvas.previewUnavailableDetail', { fileName: item.fileName })}
                </div>
              </div>
            ) : (
              <div className="px-6 text-center text-[13px] text-[#FF453A]">
                {t(
                  failReason === 'missing'
                    ? 'canvas.fileNotFound'
                    : failReason === 'unreadable'
                      ? 'canvas.fileUnreadable'
                      : 'canvas.failedToDecode',
                  { fileName: item.fileName },
                )}
              </div>
            )
          ) : (
            // original / preview chosen by the large-image strategy above. Swapping the src
            // (same key) reloads in place without losing zoom state.
            <img
              key={item.id}
              src={imageUrl(variant, item.filePath)}
              alt={item.fileName}
              draggable={canDragOut}
              onDragStart={onImageDragStart}
              onLoad={(e) => {
                setFailed(false)
                // The preview is downscaled, so its <img> size isn't the true size — natural dims
                // come from the dimensions IPC instead. Only trust the element for the original.
                if (variant === 'original') {
                  setNatural(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
                }
              }}
              onError={onImageError}
              className={imgClassName}
              style={imgStyle}
            />
          )}
        </div>
      </div>

      <ScrollOverlay scrollRef={scrollRef} />

      {/* Edge strips that reveal their arrow only when the pointer is near that edge. */}
      {showPrev && (
        <button
          type="button"
          title={t('canvas.previous')}
          onClick={prevGroup}
          className="group/nav absolute inset-y-0 left-0 flex w-[20%] items-center justify-start pl-3 opacity-0 transition-opacity hover:opacity-100"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white/85 backdrop-blur transition-colors group-hover/nav:bg-black/65 group-hover/nav:text-white">
            <ChevronLeft size={22} />
          </span>
        </button>
      )}
      {showNext && (
        <button
          type="button"
          title={t('canvas.next')}
          onClick={nextGroup}
          className="group/nav absolute inset-y-0 right-0 flex w-[20%] items-center justify-end pr-3 opacity-0 transition-opacity hover:opacity-100"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white/85 backdrop-blur transition-colors group-hover/nav:bg-black/65 group-hover/nav:text-white">
            <ChevronRight size={22} />
          </span>
        </button>
      )}

      <div className="pointer-events-none absolute bottom-2.5 left-2.5 rounded-lg border border-white/[0.08] bg-black/55 px-2.5 py-1 font-mono text-[11px] text-white/90 backdrop-blur">
        {item.fileName}
      </div>

      {/* Only shown while a grid slot is temporarily expanded — click (or Esc) returns to the grid. */}
      {expanded && (
        <button
          type="button"
          title={t('canvas.backToGrid')}
          onClick={collapse}
          className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-black/45 text-white/70 backdrop-blur transition-colors hover:bg-black/70 hover:text-white"
        >
          <ShrinkIcon size={18} />
        </button>
      )}
    </div>
  )
}
