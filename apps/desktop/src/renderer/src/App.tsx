import { useEffect } from 'react'
import { AutoModePrompt } from './components/AutoModePrompt'
import { AutoModeStrip } from './components/AutoModeStrip'
import { BatchTasksPage } from './components/BatchTasksPage'
import { Canvas } from './components/Canvas'
import { ContextMenu } from './components/ContextMenu'
import { EmptyState } from './components/EmptyState'
import { EraseDialog } from './components/EraseDialog'
import { ExifDrawer } from './components/ExifDrawer'
import { FolderPrompt } from './components/FolderPrompt'
import { ImmersiveChrome } from './components/ImmersiveChrome'
import { MultiView } from './components/MultiView'
import { QueueRail } from './components/QueueRail'
import { SettingsPage } from './components/SettingsPage'
import { StatusBar } from './components/StatusBar'
import { TitleBar } from './components/TitleBar'
import { Toast } from './components/Toast'
import { Toolbar } from './components/Toolbar'
import { TrashConfirmDialog } from './components/TrashConfirmDialog'
import { useAutoErase } from './hooks/useAutoErase'
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
  useAutoErase()

  const hasImages = useQueueStore((s) => s.items.length > 0)
  const currentId = useQueueStore((s) => s.items[s.currentIndex]?.id)
  const mode = useMultiViewStore((s) => s.mode)
  const expanded = useMultiViewStore((s) => s.expanded)
  const activeView = useUiStore((s) => s.activeView)
  const queueCollapsed = useUiStore((s) => s.queueCollapsed)
  const fullscreen = useUiStore((s) => s.fullscreen)
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

  // Track fullscreen (initial + push) to switch into the immersive viewer layout.
  useEffect(() => {
    const setFullscreen = useUiStore.getState().setFullscreen
    void window.gv.win.isFullscreen().then(setFullscreen)
    return window.gv.win.onFullscreenChanged(setFullscreen)
  }, [])

  const single = mode === 'single' || expanded
  // Immersive only while actually viewing images — keeps chrome visible in settings/batch/empty so
  // fullscreen there can't trap the user behind hidden controls.
  const immersive = fullscreen && activeView === 'viewer' && hasImages

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
      {/* `{!immersive && …}` (not removed) keeps these as positional holes so the content row
          stays at the same index and Canvas isn't remounted when toggling fullscreen. */}
      {!immersive && <TitleBar />}
      {!immersive && <Toolbar />}
      {!immersive && <AutoModeStrip />}
      <div className="relative flex min-h-0 min-w-0 flex-1">
        {activeView === 'settings' ? (
          <SettingsPage />
        ) : activeView === 'batch_tasks' ? (
          <BatchTasksPage />
        ) : hasImages ? (
          <>
            {!queueCollapsed && !immersive && <QueueRail />}
            <ContextMenu>{single ? <Canvas /> : <MultiView />}</ContextMenu>
            {exifOpen && <ExifDrawer />}
          </>
        ) : (
          <EmptyState />
        )}
        {immersive && <ImmersiveChrome />}
      </div>
      {!immersive && <StatusBar />}
      <TrashConfirmDialog />
      <EraseDialog />
      <AutoModePrompt />
      <FolderPrompt />
      <Toast />
    </div>
  )
}
