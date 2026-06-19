import { SORT_MODE_LABELS, SORT_MODES } from '@folio/core'
import type { SortMode } from '@folio/shared-types'
import { openFile, openFolder, toggleFullscreen } from '../lib/actions'
import { useQueueStore } from '../stores/queueStore'
import { useViewerStore } from '../stores/viewerStore'
import {
  ChevronLeft,
  ChevronRight,
  FolderIcon,
  FullscreenIcon,
  ImageIcon,
  RotateIcon,
  ShuffleIcon,
  ZoomIn,
  ZoomOut,
} from './icons'

function TbButton({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-[rgba(235,235,245,0.85)] transition-colors hover:bg-white/[0.08] disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}

const Divider = () => <div className="mx-1 h-[22px] w-px bg-white/[0.08]" />

export function Toolbar(): React.JSX.Element {
  const items = useQueueStore((s) => s.items)
  const currentIndex = useQueueStore((s) => s.currentIndex)
  const sortMode = useQueueStore((s) => s.sortMode)
  const setSortMode = useQueueStore((s) => s.setSortMode)
  const next = useQueueStore((s) => s.next)
  const prev = useQueueStore((s) => s.prev)
  const random = useQueueStore((s) => s.random)

  const fit = useViewerStore((s) => s.fit)
  const zoom = useViewerStore((s) => s.zoom)
  const zoomIn = useViewerStore((s) => s.zoomIn)
  const zoomOut = useViewerStore((s) => s.zoomOut)
  const toggleFit = useViewerStore((s) => s.toggleFit)
  const rotateCW = useViewerStore((s) => s.rotateCW)

  const hasImages = items.length > 0
  const posLabel = hasImages ? `${currentIndex + 1} / ${items.length}` : '0 / 0'

  return (
    <div className="flex h-12 flex-none items-center gap-1.5 border-b border-white/[0.06] bg-[#1C1C1E] px-3 [-webkit-app-region:no-drag]">
      <TbButton title="Open Folder (⌘⇧O)" onClick={openFolder}>
        <FolderIcon />
      </TbButton>
      <TbButton title="Open File (⌘O)" onClick={openFile}>
        <ImageIcon />
      </TbButton>

      <Divider />

      <TbButton title="Previous (←)" onClick={prev} disabled={!hasImages}>
        <ChevronLeft />
      </TbButton>
      <div className="min-w-[62px] text-center font-mono text-[13px] text-[rgba(235,235,245,0.6)] tabular-nums">
        {posLabel}
      </div>
      <TbButton title="Next (→)" onClick={next} disabled={!hasImages}>
        <ChevronRight />
      </TbButton>
      <TbButton title="Random (Shift+R)" onClick={random} disabled={!hasImages}>
        <ShuffleIcon size={16} />
      </TbButton>

      <Divider />

      <TbButton title="Zoom Out (−)" onClick={zoomOut} disabled={!hasImages}>
        <ZoomOut />
      </TbButton>
      <button
        type="button"
        title="Fit / Original (Space)"
        onClick={toggleFit}
        disabled={!hasImages}
        className="min-w-[54px] rounded-lg px-1 py-1 text-center font-mono text-xs text-[rgba(235,235,245,0.85)] tabular-nums hover:bg-white/[0.08] disabled:opacity-30"
      >
        {hasImages ? (fit ? 'Fit' : `${zoom}%`) : '—'}
      </button>
      <TbButton title="Zoom In (+)" onClick={zoomIn} disabled={!hasImages}>
        <ZoomIn />
      </TbButton>
      <TbButton title="Rotate (R)" onClick={rotateCW} disabled={!hasImages}>
        <RotateIcon />
      </TbButton>

      <div className="ml-auto flex items-center gap-2">
        <select
          title="Sort order"
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          disabled={!hasImages}
          className="rounded-lg bg-[#2C2C2E] px-2.5 py-1.5 text-[13px] text-[rgba(235,235,245,0.85)] outline-none disabled:opacity-30"
        >
          {SORT_MODES.map((m) => (
            <option key={m} value={m}>
              {SORT_MODE_LABELS[m]}
            </option>
          ))}
        </select>
        <TbButton title="Fullscreen (F11)" onClick={toggleFullscreen} disabled={!hasImages}>
          <FullscreenIcon size={17} />
        </TbButton>
      </div>
    </div>
  )
}
