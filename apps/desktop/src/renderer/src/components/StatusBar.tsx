import { groupStartForIndex, viewCountForMode } from '@folio/core'
import type { MultiViewMode } from '@folio/shared-types'
import { type I18nKey, useT } from '../i18n'
import { formatBytes, formatLabel } from '../lib/format'
import { useMultiViewStore } from '../stores/multiViewStore'
import { useQueueStore } from '../stores/queueStore'
import { useViewerStore } from '../stores/viewerStore'

const MODE_LABEL_KEYS: Record<MultiViewMode, I18nKey> = {
  single: 'status.mode.single',
  dual: 'status.mode.dual',
  triple: 'status.mode.triple',
  quad: 'status.mode.quad',
}

export function StatusBar(): React.JSX.Element {
  const t = useT()
  const item = useQueueStore((s) => s.items[s.currentIndex])
  const currentIndex = useQueueStore((s) => s.currentIndex)
  const total = useQueueStore((s) => s.items.length)
  const mode = useMultiViewStore((s) => s.mode)
  const syncZoom = useMultiViewStore((s) => s.syncZoom)
  const fit = useViewerStore((s) => s.fit)
  const zoom = useViewerStore((s) => s.zoom)
  const w = useViewerStore((s) => s.naturalWidth)
  const h = useViewerStore((s) => s.naturalHeight)

  const dims = w && h ? `${w} × ${h}` : '—'

  // Current group span, e.g. "21–24 / 1000" (1-based, clamped to the queue end).
  const start = groupStartForIndex(currentIndex, mode)
  const end = Math.min(start + viewCountForMode(mode), total)
  const range =
    mode === 'single' ? `${currentIndex + 1} / ${total}` : `${start + 1}–${end} / ${total}`

  return (
    <div className="flex h-7 flex-none items-center gap-3.5 border-t border-white/[0.06] bg-[#161618] px-3.5 font-mono text-[11px] text-[rgba(235,235,245,0.5)]">
      {item ? (
        <>
          {mode !== 'single' && <span className="text-[#0A84FF]">{t(MODE_LABEL_KEYS[mode])}</span>}
          <span className="truncate text-[rgba(235,235,245,0.75)]">{item.fileName}</span>
          <span>{dims}</span>
          <span>{formatLabel(item)}</span>
          <span>{formatBytes(item.size)}</span>
          <div className="ml-auto flex items-center gap-3.5">
            {mode !== 'single' && syncZoom && (
              <span className="text-[#0A84FF]">{t('status.sync')}</span>
            )}
            <span>{fit ? t('status.fit') : `${zoom}%`}</span>
            <span className="text-[rgba(235,235,245,0.75)]">{range}</span>
          </div>
        </>
      ) : (
        <span>{t('status.noFolderOpen')}</span>
      )}
    </div>
  )
}
