import { type ExifSummaryRow, exifToJsonString, filterExifGroups, summarizeExif } from '@folio/core'
import type { ExifMetadata } from '@folio/shared-types'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { copyText } from '../lib/actions'
import { groupColor, SUMMARY_LABEL_KEYS, summaryValueColor } from '../lib/exif'
import { useEraseStore } from '../stores/eraseStore'
import { type ExifTab, useExifStore } from '../stores/exifStore'
import { useQueueStore } from '../stores/queueStore'
import { CloseIcon, CopyIcon, SearchIcon, ShieldIcon } from './icons'
import { ScrollOverlay } from './ScrollOverlay'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; data: ExifMetadata }

const TABS: ExifTab[] = ['summary', 'grouped', 'raw']

export function ExifDrawer(): React.JSX.Element {
  const t = useT()
  const item = useQueueStore((s) => s.items[s.currentIndex])
  const tab = useExifStore((s) => s.tab)
  const setTab = useExifStore((s) => s.setTab)
  const search = useExifStore((s) => s.search)
  const setSearch = useExifStore((s) => s.setSearch)
  const close = useExifStore((s) => s.close)
  const refreshToken = useExifStore((s) => s.refreshToken)
  const openErase = useEraseStore((s) => s.openFor)
  const scrollRef = useRef<HTMLDivElement>(null)

  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const itemId = item?.id

  // Follow the focused image. Read lazily (only while the drawer is mounted) and ignore stale
  // responses when navigating quickly. The main process caches by path+mtime, so revisits snap.
  // biome-ignore lint/correctness/useExhaustiveDependencies: filePath is derived from id; key off id
  useEffect(() => {
    if (!item) return
    let cancelled = false
    setState({ status: 'loading' })
    window.gv.metadata
      .read(item.filePath)
      .then((data) => {
        if (cancelled) return
        setState(data ? { status: 'loaded', data } : { status: 'error' })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [itemId, refreshToken])

  const groups = state.status === 'loaded' ? state.data.groups : []
  const filtered = useMemo(() => filterExifGroups(groups, search), [groups, search])
  const ifd1 = state.status === 'loaded' ? state.data.ifd1 : undefined
  const summary = useMemo(() => summarizeExif(groups, ifd1), [groups, ifd1])
  // Raw view = the unprocessed `{ group: { key: value } }` JSON (search narrows it to matching
  // groups, same as Grouped). filePath is carried through but unused by exifToJsonString.
  const rawJson = useMemo(() => exifToJsonString({ filePath: '', groups: filtered }), [filtered])

  const showSearch = tab !== 'summary' && state.status === 'loaded' && groups.length > 0

  return (
    <div className="flex w-[332px] flex-none flex-col border-l border-white/[0.06] bg-[#161618]">
      {/* Header: title + close, then the focused file name */}
      <div className="flex-none border-b border-white/[0.06] px-4 pt-3.5 pb-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[17px] font-semibold tracking-[-0.4px] text-white">
            {t('exif.title')}
          </span>
          <button
            type="button"
            title={t('exif.close')}
            onClick={close}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[rgba(235,235,245,0.6)] transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <CloseIcon size={16} />
          </button>
        </div>
        <div className="mt-1 truncate font-mono text-[12px] text-[rgba(235,235,245,0.4)]">
          {item ? item.fileName : t('exif.noImage')}
        </div>
      </div>

      {/* Three-view toggle */}
      <div className="flex flex-none gap-0.5 p-2">
        {TABS.map((tb) => (
          <button
            type="button"
            key={tb}
            onClick={() => setTab(tb)}
            className={`flex-1 rounded-md py-1.5 text-[13px] transition-colors ${
              tb === tab
                ? 'bg-[#0A84FF]/20 text-[#0A84FF]'
                : 'text-[rgba(235,235,245,0.6)] hover:bg-white/[0.06]'
            }`}
          >
            {t(`exif.tab.${tb}`)}
          </button>
        ))}
      </div>

      {/* Search (grouped / raw only) */}
      {showSearch && (
        <div className="flex-none px-3 pb-2">
          <div className="flex items-center gap-2 rounded-lg bg-[#2C2C2E] px-2.5 py-1.5">
            <span className="text-[rgba(235,235,245,0.4)]">
              <SearchIcon size={15} />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('exif.search')}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-[rgba(235,235,245,0.35)]"
            />
            {search && (
              <button
                type="button"
                title={t('exif.clearSearch')}
                onClick={() => setSearch('')}
                className="flex-none text-[rgba(235,235,245,0.4)] hover:text-white"
              >
                <CloseIcon size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="relative min-h-0 flex-1">
        <div ref={scrollRef} className="no-scrollbar absolute inset-0 overflow-y-auto px-3 pb-3">
          {state.status === 'loading' ? (
            <Centered>
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
              <span>{t('exif.loading')}</span>
            </Centered>
          ) : state.status === 'error' ? (
            <Centered>{t('exif.failed')}</Centered>
          ) : groups.length === 0 ? (
            <Centered>{t('exif.empty')}</Centered>
          ) : tab === 'summary' ? (
            <SummaryView rows={summary} t={t} />
          ) : filtered.length === 0 ? (
            <Centered>{t('exif.noMatches')}</Centered>
          ) : tab === 'raw' ? (
            <RawJsonView json={rawJson} />
          ) : (
            <GroupedView groups={filtered} />
          )}
        </div>
        <ScrollOverlay scrollRef={scrollRef} />
      </div>

      {/* Footer: erase (privacy) + copy everything */}
      {item && (
        <div className="flex flex-none flex-col gap-2 border-t border-white/[0.06] p-3">
          <button
            type="button"
            onClick={() => openErase(item.filePath, item.fileName)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#2C2C2E] py-2.5 text-[13px] text-white transition-colors hover:bg-white/[0.12]"
          >
            <span className="text-[#FF9F0A]">
              <ShieldIcon size={15} />
            </span>
            {t('exif.erase')}
          </button>
          {state.status === 'loaded' && groups.length > 0 && (
            <button
              type="button"
              onClick={() => copyText(exifToJsonString(state.data), 'toast.metadataCopied')}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-[12px] text-[rgba(235,235,245,0.6)] transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <CopyIcon size={14} />
              {t('exif.copyAll')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-[13px] text-[rgba(235,235,245,0.45)]">
      {children}
    </div>
  )
}

function SummaryView({
  rows,
  t,
}: {
  rows: ExifSummaryRow[]
  t: ReturnType<typeof useT>
}): React.JSX.Element {
  if (rows.length === 0) return <Centered>{t('exif.empty')}</Centered>
  return (
    <div className="mt-1 overflow-hidden rounded-xl bg-[#1C1C1E]">
      {rows.map((r) => (
        <div
          key={r.id}
          className="flex items-center justify-between gap-3 border-b border-[rgba(84,84,88,0.4)] px-3.5 py-2.5 last:border-b-0"
        >
          <span className="flex-none text-[13px] text-[rgba(235,235,245,0.6)]">
            {t(SUMMARY_LABEL_KEYS[r.id])}
          </span>
          <span
            className="truncate text-right font-mono text-[13px] font-medium"
            style={{ color: summaryValueColor(r.id) ?? '#fff' }}
            title={r.value}
          >
            {r.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function GroupedView({
  groups,
}: {
  groups: { group: string; entries: { key: string; value: string }[] }[]
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3.5 pt-1.5">
      {groups.map((g) => (
        <div key={g.group}>
          <div
            className="mx-1 mb-1.5 text-[11px] font-bold uppercase tracking-[0.5px]"
            style={{ color: groupColor(g.group) }}
          >
            {g.group}
          </div>
          <div className="overflow-hidden rounded-[10px] bg-[#1C1C1E]">
            {g.entries.map((e) => (
              <button
                type="button"
                key={e.key}
                title={`${e.key}: ${e.value}`}
                onClick={() => copyText(e.value, 'toast.fieldCopied')}
                className="flex w-full items-center justify-between gap-2.5 border-b border-[rgba(84,84,88,0.3)] px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-white/[0.04]"
              >
                <span className="flex-none text-[12px] text-[rgba(235,235,245,0.55)]">{e.key}</span>
                <span className="truncate text-right font-mono text-[12px] text-[rgba(235,235,245,0.9)]">
                  {e.value}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Raw view: the metadata serialised to JSON, selectable for copy (matches the footer's "copy all"). */
function RawJsonView({ json }: { json: string }): React.JSX.Element {
  return (
    <pre className="mt-1.5 whitespace-pre-wrap break-words rounded-[10px] bg-[#1C1C1E] px-3 py-2.5 font-mono text-[11px] leading-[1.5] text-[rgba(235,235,245,0.85)] selection:bg-[#0A84FF]/30">
      {json}
    </pre>
  )
}
