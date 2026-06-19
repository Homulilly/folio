import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { canRenderNatively, formatLabel, imageUrl } from '../lib/format'
import { useMultiViewStore } from '../stores/multiViewStore'
import { useQueueStore } from '../stores/queueStore'
import { useViewerStore } from '../stores/viewerStore'
import { ChevronLeft, ChevronRight, ShrinkIcon } from './icons'
import { ScrollOverlay } from './ScrollOverlay'

export function Canvas(): React.JSX.Element {
  const t = useT()
  const item = useQueueStore((s) => s.items[s.currentIndex])
  const currentIndex = useQueueStore((s) => s.currentIndex)
  const total = useQueueStore((s) => s.items.length)
  const expanded = useMultiViewStore((s) => s.expanded)
  const collapse = useMultiViewStore((s) => s.collapse)
  const loopEnabled = useMultiViewStore((s) => s.loopEnabled)
  const prevGroup = useMultiViewStore((s) => s.prevGroup)
  const nextGroup = useMultiViewStore((s) => s.nextGroup)
  const fit = useViewerStore((s) => s.fit)
  const zoom = useViewerStore((s) => s.zoom)
  const rotation = useViewerStore((s) => s.rotation)
  const naturalWidth = useViewerStore((s) => s.naturalWidth)
  const naturalHeight = useViewerStore((s) => s.naturalHeight)
  const viewportWidth = useViewerStore((s) => s.viewportWidth)
  const viewportHeight = useViewerStore((s) => s.viewportHeight)
  const setNatural = useViewerStore((s) => s.setNatural)

  const [failed, setFailed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const zoomRaf = useRef<number | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: setFailed is stable; reset on image change
  useEffect(() => {
    setFailed(false)
  }, [item?.id])

  // Mouse wheel zooms the image. A native, non-passive listener is required because React's
  // onWheel is passive, so preventDefault() there can't stop the canvas from scrolling. Canvas
  // only mounts when an image exists, so the container is stable — attach once. The same effect
  // tracks the viewport size so the store can resume zoom from the actual fit scale.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      const unit = e.deltaMode === 1 ? 16 : 1 // normalise line-mode deltas to pixels
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

      useViewerStore.getState().zoomBy(-e.deltaY * unit * 0.25)

      if (!anchor) return
      if (zoomRaf.current) cancelAnimationFrame(zoomRaf.current)
      zoomRaf.current = requestAnimationFrame(() => {
        const afterImg = el.querySelector<HTMLImageElement>('img')
        if (!afterImg) return
        const after = afterImg.getBoundingClientRect()
        el.scrollLeft += after.left + after.width * anchor.x - pointer.x
        el.scrollTop += after.top + after.height * anchor.y - pointer.y
        zoomRaf.current = null
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
      ro.disconnect()
    }
  }, [])

  if (!item) return <div className="flex-1" />

  const renderable = canRenderNatively(item)
  const transform = `rotate(${rotation}deg)`
  const canPan = !fit
  // Hover-reveal nav arrows; hidden at the ends unless looping.
  const showPrev = loopEnabled || currentIndex > 0
  const showNext = loopEnabled || currentIndex < total - 1

  // Resolve the displayed pixel size from natural + viewport so BOTH dimensions are
  // honoured. Fit scales the image down to fit inside the viewport (never upscaling); zoom
  // is an explicit percentage. Rotation by 90/270 swaps which natural side bounds each axis.
  // Falls back to CSS object-contain until natural/viewport sizes are known.
  const rotated = rotation === 90 || rotation === 270
  const sizable = naturalWidth && naturalHeight && (!fit || (viewportWidth && viewportHeight))
  let imgClassName = 'max-h-full max-w-full object-contain'
  let imgStyle: React.CSSProperties = { transform }
  if (naturalWidth && naturalHeight && sizable) {
    const boundW = rotated ? naturalHeight : naturalWidth
    const boundH = rotated ? naturalWidth : naturalHeight
    const scale = fit
      ? Math.min((viewportWidth as number) / boundW, (viewportHeight as number) / boundH, 1)
      : zoom / 100
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

  return (
    // Fixed positioning context: holds the background and the overlays so they never move
    // with the (scrolling) image. overflow-hidden + min-w/h-0 keep a zoomed image from
    // expanding the layout and scrolling the toolbar/queue rail.
    <div
      className="relative min-h-0 min-w-0 flex-1 overflow-hidden"
      style={{ background: 'radial-gradient(circle at 50% 38%, #131315 0%, #000 78%)' }}
    >
      <div
        ref={scrollRef}
        className={`no-scrollbar absolute inset-0 overflow-auto ${canPan ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* At least viewport-sized so a small image stays centered; grows to a zoomed image so
            it scrolls (and pans) on both axes from the top-left, not from a clipped centre. */}
        <div className="flex min-h-full min-w-full items-center justify-center">
          {!renderable ? (
            <div className="max-w-sm px-6 text-center">
              <div className="text-base font-medium text-[rgba(235,235,245,0.85)]">
                {t('canvas.previewUnavailable', { format: formatLabel(item) })}
              </div>
              <div className="mt-2 text-[13px] text-[rgba(235,235,245,0.45)]">
                {t('canvas.previewUnavailableDetail', { fileName: item.fileName })}
              </div>
            </div>
          ) : failed ? (
            <div className="px-6 text-center text-[13px] text-[#FF453A]">
              {t('canvas.failedToDecode', { fileName: item.fileName })}
            </div>
          ) : (
            <img
              key={item.id}
              src={imageUrl('original', item.filePath)}
              alt={item.fileName}
              draggable={false}
              onLoad={(e) => {
                setFailed(false)
                setNatural(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
              }}
              onError={() => setFailed(true)}
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
