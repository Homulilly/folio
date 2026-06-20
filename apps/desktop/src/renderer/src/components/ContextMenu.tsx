import { useEffect, useState } from 'react'
import { type I18nKey, useT } from '../i18n'
import {
  copyImageCurrent,
  copyPathCurrent,
  openRenameDialog,
  openSaveDialog,
  revealCurrent,
  trashCurrent,
} from '../lib/actions'
import { revealLabelKey, trashTextKeys } from '../lib/platform'

interface MenuPos {
  x: number
  y: number
}

const items: { labelKey: I18nKey; run: () => void; danger?: boolean }[] = [
  { labelKey: 'context.copyImage', run: () => void copyImageCurrent() },
  { labelKey: 'context.copyPath', run: () => void copyPathCurrent() },
  { labelKey: 'context.saveTo', run: () => openSaveDialog() },
  { labelKey: 'context.rename', run: () => openRenameDialog() },
  { labelKey: revealLabelKey(), run: () => void revealCurrent() },
  { labelKey: trashTextKeys().context, run: () => void trashCurrent(), danger: true },
]

/** Lightweight right-click menu for the canvas. Replace with Radix when the design system lands. */
export function ContextMenu({ children }: { children: React.ReactNode }): React.JSX.Element {
  const t = useT()
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
      className="flex min-h-0 min-w-0 flex-1"
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
              key={it.labelKey}
              onClick={() => {
                it.run()
                setPos(null)
              }}
              className={`block w-full px-3 py-1.5 text-left text-[13px] hover:bg-[#0A84FF] ${
                it.danger ? 'text-[#FF6961] hover:text-white' : 'text-[rgba(235,235,245,0.9)]'
              }`}
            >
              {t(it.labelKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
