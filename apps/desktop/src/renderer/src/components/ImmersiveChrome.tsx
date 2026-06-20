import { useState } from 'react'
import { useQueueStore } from '../stores/queueStore'
import { AutoModeStrip } from './AutoModeStrip'
import { QueueRail } from './QueueRail'
import { StatusBar } from './StatusBar'
import { TitleBar } from './TitleBar'
import { Toolbar } from './Toolbar'

type Edge = 'top' | 'bottom' | 'left'

const EDGE = {
  top: {
    trigger: 'inset-x-0 top-0 h-2',
    panel: 'inset-x-0 top-0 flex-col',
    hidden: '-translate-y-full',
  },
  bottom: {
    trigger: 'inset-x-0 bottom-0 h-2',
    panel: 'inset-x-0 bottom-0 flex-col',
    hidden: 'translate-y-full',
  },
  left: { trigger: 'inset-y-0 left-0 w-2', panel: 'inset-y-0 left-0', hidden: '-translate-x-full' },
} as const

/**
 * An auto-hiding chrome panel pinned to a window edge. A thin always-present trigger strip at the
 * very edge reveals the panel on hover; the panel hides again when the pointer leaves it.
 */
function EdgeReveal({
  edge,
  children,
}: {
  edge: Edge
  children: React.ReactNode
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const cfg = EDGE[edge]
  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: hover trigger; chrome stays reachable once revealed */}
      <div className={`absolute z-40 ${cfg.trigger}`} onMouseEnter={() => setOpen(true)} />
      {/* biome-ignore lint/a11y/noStaticElementInteractions: revealed chrome panel */}
      <div
        className={`absolute z-40 flex shadow-2xl transition-transform duration-200 ease-out ${cfg.panel} ${open ? '' : cfg.hidden}`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {children}
      </div>
    </>
  )
}

/**
 * Fullscreen immersive chrome (PRD §6.1): the image fills the screen and the normal title/toolbar,
 * status bar, and queue rail collapse to edge-reveal overlays — they slide in only when the pointer
 * nears their edge. Reuses the same chrome components as the windowed layout.
 */
export function ImmersiveChrome(): React.JSX.Element {
  const hasImages = useQueueStore((s) => s.items.length > 0)
  return (
    <>
      <EdgeReveal edge="top">
        <TitleBar />
        <Toolbar />
        <AutoModeStrip />
      </EdgeReveal>
      <EdgeReveal edge="bottom">
        <StatusBar />
      </EdgeReveal>
      {hasImages && (
        <EdgeReveal edge="left">
          <QueueRail />
        </EdgeReveal>
      )}
    </>
  )
}
