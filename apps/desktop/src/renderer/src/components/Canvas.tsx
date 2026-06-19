import { useEffect, useRef, useState } from 'react'
import { canRenderNatively, formatLabel, imageUrl } from '../lib/format'
import { useMultiViewStore } from '../stores/multiViewStore'
import { useQueueStore } from '../stores/queueStore'
import { useViewerStore } from '../stores/viewerStore'
import { ShrinkIcon } from './icons'

export function Canvas(): React.JSX.Element {
  const item = useQueueStore((s) => s.items[s.currentIndex])
  const expanded = useMultiViewStore((s) => s.expanded)
  const collapse = useMultiViewStore((s) => s.collapse)
  const fit = useViewerStore((s) => s.fit)
  const zoom = useViewerStore((s) => s.zoom)
  const rotation = useViewerStore((s) => s.rotation)
  const naturalWidth = useViewerStore((s) => s.naturalWidth)
  const setNatural = useViewerStore((s) => s.setNatural)

  const [failed, setFailed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)

  useEffect(() => {
    setFailed(false)
  }, [item?.id])

  if (!item) return <div className="flex-1" />

  const renderable = canRenderNatively(item)
  const transform = `rotate(${rotation}deg)`
  const canPan = !fit

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
    <div
      ref={scrollRef}
      className={`relative flex flex-1 items-center justify-center overflow-auto ${
        canPan ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
      style={{ background: 'radial-gradient(circle at 50% 38%, #131315 0%, #000 78%)' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {!renderable ? (
        <div className="max-w-sm px-6 text-center">
          <div className="text-base font-medium text-[rgba(235,235,245,0.85)]">
            {formatLabel(item)} preview not available yet
          </div>
          <div className="mt-2 text-[13px] text-[rgba(235,235,245,0.45)]">
            {item.fileName} — rendering for this format arrives with the sharp preview pipeline
            (M6/M7).
          </div>
        </div>
      ) : failed ? (
        <div className="px-6 text-center text-[13px] text-[#FF453A]">
          Failed to decode {item.fileName}
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
          className={fit ? 'max-h-full max-w-full object-contain' : 'flex-none object-contain'}
          style={
            fit
              ? { transform }
              : {
                  width: naturalWidth ? `${(naturalWidth * zoom) / 100}px` : 'auto',
                  maxWidth: 'none',
                  transform,
                }
          }
        />
      )}

      <div className="pointer-events-none absolute bottom-2.5 left-2.5 rounded-lg border border-white/[0.08] bg-black/55 px-2.5 py-1 font-mono text-[11px] text-white/90 backdrop-blur">
        {item.fileName}
      </div>

      {/* Only shown while a grid slot is temporarily expanded — click (or Esc) returns to the grid. */}
      {expanded && (
        <button
          type="button"
          title="Back to grid (Esc)"
          onClick={collapse}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-black/45 text-white/70 backdrop-blur transition-colors hover:bg-black/70 hover:text-white"
        >
          <ShrinkIcon size={18} />
        </button>
      )}
    </div>
  )
}
