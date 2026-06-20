import type { MultiViewMode } from '@folio/shared-types'
import { type I18nKey, useT } from '../i18n'
import {
  openFile,
  openFolder,
  openRenameDialog,
  openSaveDialog,
  quickSaveCurrent,
  toggleFullscreen,
} from '../lib/actions'
import { useExifStore } from '../stores/exifStore'
import { useMultiViewStore } from '../stores/multiViewStore'
import { useQueueStore } from '../stores/queueStore'
import { useSaveStore } from '../stores/saveStore'
import { useTaskStore } from '../stores/taskStore'
import { useUiStore } from '../stores/uiStore'
import { useViewerStore } from '../stores/viewerStore'
import {
  ChevronLeft,
  ChevronRight,
  FolderIcon,
  FullscreenIcon,
  ImageIcon,
  InfoIcon,
  LayoutDual,
  LayoutQuad,
  LayoutSingle,
  LayoutSwap,
  LayoutTriple,
  LoopIcon,
  QuickSaveIcon,
  RenameIcon,
  RotateIcon,
  RotateResetIcon,
  SaveIcon,
  SettingsIcon,
  ShuffleIcon,
  SidebarIcon,
  SyncIcon,
  TasksIcon,
  ZoomIn,
  ZoomOut,
} from './icons'

function TbButton({
  title,
  onClick,
  disabled,
  active,
  children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent ${
        active
          ? 'bg-[#0A84FF]/20 text-[#0A84FF]'
          : 'text-[rgba(235,235,245,0.85)] hover:bg-white/[0.08]'
      }`}
    >
      {children}
    </button>
  )
}

const Divider = () => <div className="mx-1 h-[22px] w-px bg-white/[0.08]" />

/** Last path segment, for the quick-save tooltip (e.g. ".../Exports" → "Exports"). */
const folderName = (p: string): string =>
  p.replaceAll('\\', '/').replace(/\/+$/, '').split('/').pop() ?? p

const MODE_BUTTONS: { mode: MultiViewMode; titleKey: I18nKey; Icon: typeof LayoutSingle }[] = [
  { mode: 'single', titleKey: 'toolbar.mode.single', Icon: LayoutSingle },
  { mode: 'dual', titleKey: 'toolbar.mode.dual', Icon: LayoutDual },
  { mode: 'triple', titleKey: 'toolbar.mode.triple', Icon: LayoutTriple },
  { mode: 'quad', titleKey: 'toolbar.mode.quad', Icon: LayoutQuad },
]

const MODE_HAS_LAYOUTS: Partial<Record<MultiViewMode, boolean>> = { dual: true, triple: true }

export function Toolbar(): React.JSX.Element {
  const t = useT()
  const items = useQueueStore((s) => s.items)
  const currentIndex = useQueueStore((s) => s.currentIndex)
  const random = useQueueStore((s) => s.random)

  const mode = useMultiViewStore((s) => s.mode)
  const setMode = useMultiViewStore((s) => s.setMode)
  const cycleLayout = useMultiViewStore((s) => s.cycleLayout)
  const syncZoom = useMultiViewStore((s) => s.syncZoom)
  const toggleSync = useMultiViewStore((s) => s.toggleSync)
  const loopEnabled = useMultiViewStore((s) => s.loopEnabled)
  const toggleLoop = useMultiViewStore((s) => s.toggleLoop)
  const nextGroup = useMultiViewStore((s) => s.nextGroup)
  const prevGroup = useMultiViewStore((s) => s.prevGroup)

  const quickRule = useSaveStore((s) => s.quickRule)
  const queueCollapsed = useUiStore((s) => s.queueCollapsed)
  const activeView = useUiStore((s) => s.activeView)
  const exifOpen = useExifStore((s) => s.open)
  const toggleExif = useExifStore((s) => s.toggle)
  const showViewer = useUiStore((s) => s.showViewer)
  const showSettings = useUiStore((s) => s.showSettings)
  const showBatchTasks = useUiStore((s) => s.showBatchTasks)
  const toggleQueue = useUiStore((s) => s.toggleQueue)
  const tasks = useTaskStore((s) => s.tasks)
  const tasksActive = activeView === 'batch_tasks'
  const anyRunning = tasks.some((t) => t.status === 'running' || t.status === 'paused')

  const fit = useViewerStore((s) => s.fit)
  const zoom = useViewerStore((s) => s.zoom)
  const zoomIn = useViewerStore((s) => s.zoomIn)
  const zoomOut = useViewerStore((s) => s.zoomOut)
  const toggleFit = useViewerStore((s) => s.toggleFit)
  const rotateCW = useViewerStore((s) => s.rotateCW)
  const rotation = useViewerStore((s) => s.rotation)
  const resetRotation = useViewerStore((s) => s.resetRotation)

  const hasImages = items.length > 0
  const posLabel = hasImages ? `${currentIndex + 1} / ${items.length}` : '0 / 0'

  return (
    <div className="flex h-12 flex-none items-center gap-1.5 border-b border-white/[0.06] bg-[#1C1C1E] px-3 [-webkit-app-region:no-drag]">
      <TbButton
        title={queueCollapsed ? t('toolbar.showSidebar') : t('toolbar.hideSidebar')}
        onClick={toggleQueue}
        active={!queueCollapsed}
      >
        <SidebarIcon />
      </TbButton>

      <Divider />

      <TbButton title={t('toolbar.openFolder')} onClick={openFolder}>
        <FolderIcon />
      </TbButton>
      <TbButton title={t('toolbar.openFile')} onClick={openFile}>
        <ImageIcon />
      </TbButton>
      <TbButton title={t('toolbar.saveTo')} onClick={openSaveDialog} disabled={!hasImages}>
        <SaveIcon size={17} />
      </TbButton>
      <TbButton
        title={
          quickRule
            ? t('toolbar.quickSaveTo', { dir: folderName(quickRule.targetDir) })
            : t('toolbar.quickSaveSetup')
        }
        onClick={() => void quickSaveCurrent()}
        disabled={!hasImages}
      >
        <QuickSaveIcon size={17} />
      </TbButton>
      <TbButton title={t('toolbar.rename')} onClick={openRenameDialog} disabled={!hasImages}>
        <RenameIcon size={17} />
      </TbButton>

      <Divider />

      {MODE_BUTTONS.map(({ mode: m, titleKey, Icon }) => (
        <TbButton
          key={m}
          title={t(titleKey)}
          onClick={() => setMode(m)}
          active={mode === m}
          disabled={!hasImages}
        >
          <Icon size={17} />
        </TbButton>
      ))}
      {MODE_HAS_LAYOUTS[mode] && (
        <TbButton title={t('toolbar.swapLayout')} onClick={cycleLayout} disabled={!hasImages}>
          <LayoutSwap size={16} />
        </TbButton>
      )}

      <Divider />

      <TbButton title={t('toolbar.previousGroup')} onClick={prevGroup} disabled={!hasImages}>
        <ChevronLeft />
      </TbButton>
      <div className="min-w-[62px] text-center font-mono text-[13px] text-[rgba(235,235,245,0.6)] tabular-nums">
        {posLabel}
      </div>
      <TbButton title={t('toolbar.nextGroup')} onClick={nextGroup} disabled={!hasImages}>
        <ChevronRight />
      </TbButton>
      <TbButton title={t('toolbar.random')} onClick={random} disabled={!hasImages}>
        <ShuffleIcon size={16} />
      </TbButton>
      {mode !== 'single' && (
        <>
          <TbButton
            title={t('toolbar.syncZoom')}
            onClick={toggleSync}
            active={syncZoom}
            disabled={!hasImages}
          >
            <SyncIcon size={17} />
          </TbButton>
          <TbButton
            title={t('toolbar.loopBrowsing')}
            onClick={toggleLoop}
            active={loopEnabled}
            disabled={!hasImages}
          >
            <LoopIcon size={16} />
          </TbButton>
        </>
      )}

      <Divider />

      <TbButton title={t('toolbar.zoomOut')} onClick={zoomOut} disabled={!hasImages}>
        <ZoomOut />
      </TbButton>
      <button
        type="button"
        title={t('toolbar.fitOriginal')}
        onClick={toggleFit}
        disabled={!hasImages}
        className="min-w-[54px] rounded-lg px-1 py-1 text-center font-mono text-xs text-[rgba(235,235,245,0.85)] tabular-nums hover:bg-white/[0.08] disabled:opacity-30"
      >
        {hasImages ? (fit ? t('toolbar.fit') : `${Math.round(zoom)}%`) : '—'}
      </button>
      <TbButton title={t('toolbar.zoomIn')} onClick={zoomIn} disabled={!hasImages}>
        <ZoomIn />
      </TbButton>
      <TbButton title={t('toolbar.rotate')} onClick={rotateCW} disabled={!hasImages}>
        <RotateIcon />
      </TbButton>
      <TbButton
        title={t('toolbar.resetOrientation')}
        onClick={resetRotation}
        disabled={!hasImages || rotation === 0}
      >
        <RotateResetIcon />
      </TbButton>

      <div className="ml-auto flex items-center gap-1.5">
        <TbButton title={t('toolbar.fullscreen')} onClick={toggleFullscreen} disabled={!hasImages}>
          <FullscreenIcon size={17} />
        </TbButton>
        <TbButton
          title={t('toolbar.exifInfo')}
          onClick={toggleExif}
          active={exifOpen}
          disabled={!hasImages}
        >
          <InfoIcon size={17} />
        </TbButton>
        {tasks.length > 0 && (
          <TbButton
            title={t('toolbar.tasks')}
            onClick={tasksActive ? showViewer : showBatchTasks}
            active={tasksActive}
          >
            <span className="relative">
              <TasksIcon size={17} />
              {anyRunning && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#0A84FF] ring-2 ring-[#1C1C1E]" />
              )}
            </span>
          </TbButton>
        )}
        <TbButton
          title={activeView === 'settings' ? t('toolbar.backToViewer') : t('toolbar.settings')}
          onClick={activeView === 'settings' ? showViewer : showSettings}
          active={activeView === 'settings'}
        >
          <SettingsIcon size={17} />
        </TbButton>
      </div>
    </div>
  )
}
