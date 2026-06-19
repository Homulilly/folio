import { formatBytes, formatLabel } from '../lib/format'
import { useQueueStore } from '../stores/queueStore'
import { useViewerStore } from '../stores/viewerStore'

export function StatusBar(): React.JSX.Element {
  const item = useQueueStore((s) => s.items[s.currentIndex])
  const currentIndex = useQueueStore((s) => s.currentIndex)
  const total = useQueueStore((s) => s.items.length)
  const fit = useViewerStore((s) => s.fit)
  const zoom = useViewerStore((s) => s.zoom)
  const w = useViewerStore((s) => s.naturalWidth)
  const h = useViewerStore((s) => s.naturalHeight)

  const dims = w && h ? `${w} × ${h}` : '—'

  return (
    <div className="flex h-7 flex-none items-center gap-3.5 border-t border-white/[0.06] bg-[#161618] px-3.5 font-mono text-[11px] text-[rgba(235,235,245,0.5)]">
      {item ? (
        <>
          <span className="truncate text-[rgba(235,235,245,0.75)]">{item.fileName}</span>
          <span>{dims}</span>
          <span>{formatLabel(item)}</span>
          <span>{formatBytes(item.size)}</span>
          <div className="ml-auto flex items-center gap-3.5">
            <span>{fit ? 'Fit' : `${zoom}%`}</span>
            <span className="text-[rgba(235,235,245,0.75)]">
              {currentIndex + 1} / {total}
            </span>
          </div>
        </>
      ) : (
        <span>No folder open</span>
      )}
    </div>
  )
}
