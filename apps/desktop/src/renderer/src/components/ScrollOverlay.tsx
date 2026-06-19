import { useEffect, useState } from 'react'

interface Metrics {
  scrollTop: number
  scrollLeft: number
  scrollHeight: number
  scrollWidth: number
  clientHeight: number
  clientWidth: number
}

const ZERO: Metrics = {
  scrollTop: 0,
  scrollLeft: 0,
  scrollHeight: 0,
  scrollWidth: 0,
  clientHeight: 0,
  clientWidth: 0,
}

const MIN_THUMB = 28
const THICKNESS = 6

/**
 * Translucent, thumb-only scrollbars overlaid on the scroll target. The target hides its
 * native scrollbar (`.no-scrollbar`), so these take no layout space — content never shifts
 * when scrolling appears or disappears. Thumbs are draggable and only render when their axis
 * overflows.
 */
export function ScrollOverlay({
  scrollRef,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>
}): React.JSX.Element | null {
  const [m, setM] = useState<Metrics>(ZERO)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = (): void =>
      setM({
        scrollTop: el.scrollTop,
        scrollLeft: el.scrollLeft,
        scrollHeight: el.scrollHeight,
        scrollWidth: el.scrollWidth,
        clientHeight: el.clientHeight,
        clientWidth: el.clientWidth,
      })
    update()
    el.addEventListener('scroll', update, { passive: true })
    // Track both viewport size (el) and content size (its wrapper) — zooming resizes content.
    const ro = new ResizeObserver(update)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [scrollRef])

  const vOverflow = m.scrollHeight - m.clientHeight > 1
  const hOverflow = m.scrollWidth - m.clientWidth > 1

  // Drag a thumb: translate pointer movement along the track into a scroll offset.
  const startDrag =
    (axis: 'y' | 'x') =>
    (e: React.PointerEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      const el = scrollRef.current
      if (!el) return
      const vertical = axis === 'y'
      const client = vertical ? m.clientHeight : m.clientWidth
      const scroll = vertical ? m.scrollHeight : m.scrollWidth
      const thumb = Math.max(MIN_THUMB, (client * client) / scroll)
      const trackRange = client - thumb
      const scrollRange = scroll - client
      const startPos = vertical ? e.clientY : e.clientX
      const startScroll = vertical ? el.scrollTop : el.scrollLeft
      const onMove = (ev: PointerEvent): void => {
        const delta = (vertical ? ev.clientY : ev.clientX) - startPos
        const next = startScroll + (trackRange > 0 ? (delta / trackRange) * scrollRange : 0)
        if (vertical) el.scrollTop = next
        else el.scrollLeft = next
      }
      const onUp = (): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }

  if (!vOverflow && !hOverflow) return null

  const vThumb = Math.max(MIN_THUMB, (m.clientHeight * m.clientHeight) / m.scrollHeight)
  const vTop = ((m.clientHeight - vThumb) * m.scrollTop) / (m.scrollHeight - m.clientHeight || 1)
  const hThumb = Math.max(MIN_THUMB, (m.clientWidth * m.clientWidth) / m.scrollWidth)
  const hLeft = ((m.clientWidth - hThumb) * m.scrollLeft) / (m.scrollWidth - m.clientWidth || 1)

  const thumbClass =
    'pointer-events-auto absolute rounded-full bg-[#AEAEB2]/55 transition-colors hover:bg-[#AEAEB2]/80'

  return (
    <div className="pointer-events-none absolute inset-0">
      {vOverflow && (
        <div
          className={thumbClass}
          style={{ top: vTop, right: 2, width: THICKNESS, height: vThumb }}
          onPointerDown={startDrag('y')}
        />
      )}
      {hOverflow && (
        <div
          className={thumbClass}
          style={{ left: hLeft, bottom: 2, height: THICKNESS, width: hThumb }}
          onPointerDown={startDrag('x')}
        />
      )}
    </div>
  )
}
