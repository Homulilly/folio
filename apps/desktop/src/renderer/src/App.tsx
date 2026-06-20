import { useEffect } from 'react'
import { BatchTasksPage } from './components/BatchTasksPage'
import { Canvas } from './components/Canvas'
import { ContextMenu } from './components/ContextMenu'
import { EmptyState } from './components/EmptyState'
import { EraseDialog } from './components/EraseDialog'
import { ExifDrawer } from './components/ExifDrawer'
import { MultiView } from './components/MultiView'
import { QueueRail } from './components/QueueRail'
import { SettingsPage } from './components/SettingsPage'
import { StatusBar } from './components/StatusBar'
import { TitleBar } from './components/TitleBar'
import { Toast } from './components/Toast'
import { Toolbar } from './components/Toolbar'
import { TrashConfirmDialog } from './components/TrashConfirmDialog'
import { useShortcuts } from './hooks/useShortcuts'
import { openPaths } from './lib/actions'
import { useExifStore } from './stores/exifStore'
import { useMultiViewStore } from './stores/multiViewStore'
import { useQueueStore } from './stores/queueStore'
import { useTaskStore } from './stores/taskStore'
import { useUiStore } from './stores/uiStore'
import { useViewerStore } from './stores/viewerStore'

export function App(): React.JSX.Element {
  useShortcuts()

  const hasImages = useQueueStore((s) => s.items.length > 0)
  const currentId = useQueueStore((s) => s.items[s.currentIndex]?.id)
  const mode = useMultiViewStore((s) => s.mode)
  const expanded = useMultiViewStore((s) => s.expanded)
  const activeView = useUiStore((s) => s.activeView)
  const queueCollapsed = useUiStore((s) => s.queueCollapsed)
  const exifOpen = useExifStore((s) => s.open)
  const resetViewer = useViewerStore((s) => s.reset)

  // Single image: reset zoom/fit/rotation on each image. In the grid we keep zoom across
  // focus/group changes so a sync-zoom comparison survives stepping.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset is stable; key off the image id
  useEffect(() => {
    if (useMultiViewStore.getState().mode === 'single') resetViewer()
  }, [currentId])

  // Mirror the main-process scheduler's task list (initial snapshot + live push updates).
  useEffect(() => {
    const setTasks = useTaskStore.getState().setTasks
    void window.gv.task.list().then(setTasks)
    return window.gv.task.onUpdate(setTasks)
  }, [])

  const single = mode === 'single' || expanded

  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    const paths = Array.from(e.dataTransfer.files).map((f) => window.gv.getPathForFile(f))
    void openPaths(paths.filter(Boolean))
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: window-wide drag-and-drop drop zone
    <div
      className="flex h-full flex-col overflow-hidden"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <TitleBar />
      <Toolbar />
      <div className="flex min-h-0 min-w-0 flex-1">
        {activeView === 'settings' ? (
          <SettingsPage />
        ) : activeView === 'batch_tasks' ? (
          <BatchTasksPage />
        ) : hasImages ? (
          <>
            {!queueCollapsed && <QueueRail />}
            <ContextMenu>{single ? <Canvas /> : <MultiView />}</ContextMenu>
            {exifOpen && <ExifDrawer />}
          </>
        ) : (
          <EmptyState />
        )}
      </div>
      <StatusBar />
      <TrashConfirmDialog />
      <EraseDialog />
      <Toast />
    </div>
  )
}
