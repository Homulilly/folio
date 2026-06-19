import { useEffect } from 'react'
import { Canvas } from './components/Canvas'
import { ContextMenu } from './components/ContextMenu'
import { EmptyState } from './components/EmptyState'
import { QueueRail } from './components/QueueRail'
import { StatusBar } from './components/StatusBar'
import { TitleBar } from './components/TitleBar'
import { Toast } from './components/Toast'
import { Toolbar } from './components/Toolbar'
import { useShortcuts } from './hooks/useShortcuts'
import { openPaths } from './lib/actions'
import { useQueueStore } from './stores/queueStore'
import { useViewerStore } from './stores/viewerStore'

export function App(): React.JSX.Element {
  useShortcuts()

  const hasImages = useQueueStore((s) => s.items.length > 0)
  const currentId = useQueueStore((s) => s.items[s.currentIndex]?.id)
  const resetViewer = useViewerStore((s) => s.reset)

  // Reset zoom/fit/rotation whenever the focused image changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset is stable; key off the image id
  useEffect(() => {
    resetViewer()
  }, [currentId])

  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    const paths = Array.from(e.dataTransfer.files).map((f) => window.gv.getPathForFile(f))
    void openPaths(paths.filter(Boolean))
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: window-wide drag-and-drop drop zone
    <div className="flex h-full flex-col" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <TitleBar />
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        {hasImages ? (
          <>
            <QueueRail />
            <ContextMenu>
              <Canvas />
            </ContextMenu>
          </>
        ) : (
          <EmptyState />
        )}
      </div>
      <StatusBar />
      <Toast />
    </div>
  )
}
