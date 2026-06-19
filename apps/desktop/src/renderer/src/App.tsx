import { nextGroupStart } from '@galleryviewer/core'
import type { SystemInfo } from '@galleryviewer/shared-types'
import { useEffect, useState } from 'react'
import { useAppStore } from './stores/appStore'

export function App(): React.JSX.Element {
  const view = useAppStore((s) => s.view)
  const [ping, setPing] = useState<string>('…')
  const [info, setInfo] = useState<SystemInfo | null>(null)

  useEffect(() => {
    void window.gv.system.ping().then(setPing)
    void window.gv.system.getInfo().then(setInfo)
  }, [])

  // Touch a packages/core function so the workspace wiring is exercised end-to-end.
  const demoNextGroup = nextGroupStart({ startIndex: 0, mode: 'quad', total: 1000 })

  return (
    <div className="flex h-full flex-col">
      {/* Draggable title bar region (window has a hidden native title bar on macOS).
          Interactive controls placed here later must opt out with [-webkit-app-region:no-drag]. */}
      <header className="flex h-[38px] flex-none items-center justify-center border-b border-white/[0.06] text-[13px] font-semibold text-[rgba(235,235,245,0.6)] [-webkit-app-region:drag]">
        GalleryViewer
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="text-2xl font-semibold tracking-tight">M0 scaffold is alive 🎉</div>
        <div className="font-mono text-sm text-[rgba(235,235,245,0.6)]">
          <div>view store: {view}</div>
          <div>IPC system.ping → {ping}</div>
          <div>core.nextGroupStart(quad, 0) → {demoNextGroup}</div>
          {info && (
            <div className="mt-2 text-[rgba(235,235,245,0.45)]">
              Electron {info.electronVersion} · Chrome {info.chromeVersion} · Node{' '}
              {info.nodeVersion} · {info.platform}/{info.arch}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
