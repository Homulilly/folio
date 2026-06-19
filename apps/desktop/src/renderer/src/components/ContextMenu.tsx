import { useEffect, useState } from 'react'
import { copyImageCurrent, copyPathCurrent, revealCurrent, trashCurrent } from '../lib/actions'

interface MenuPos {
  x: number
  y: number
}

const items: { label: string; run: () => void; danger?: boolean }[] = [
  { label: 'Copy Image', run: () => void copyImageCurrent() },
  { label: 'Copy Path', run: () => void copyPathCurrent() },
  { label: 'Reveal in Finder', run: () => void revealCurrent() },
  { label: 'Move to Trash', run: () => void trashCurrent(), danger: true },
]

/** Lightweight right-click menu for the canvas. Replace with Radix when the design system lands. */
export function ContextMenu({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [pos, setPos] = useState<MenuPos | null>(null)

  useEffect(() => {
    if (!pos) return
    const close = () => setPos(null)
    window.addEventListener('click', close)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('resize', close)
    }
  }, [pos])

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: right-click surface for the canvas
    <div
      className="flex min-h-0 flex-1"
      onContextMenu={(e) => {
        e.preventDefault()
        setPos({ x: e.clientX, y: e.clientY })
      }}
    >
      {children}
      {pos && (
        <div
          className="fixed z-50 min-w-44 overflow-hidden rounded-lg border border-white/10 bg-[#2C2C2E] py-1 shadow-2xl"
          style={{ top: pos.y, left: pos.x }}
        >
          {items.map((it) => (
            <button
              type="button"
              key={it.label}
              onClick={() => {
                it.run()
                setPos(null)
              }}
              className={`block w-full px-3 py-1.5 text-left text-[13px] hover:bg-[#0A84FF] ${
                it.danger ? 'text-[#FF6961] hover:text-white' : 'text-[rgba(235,235,245,0.9)]'
              }`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
