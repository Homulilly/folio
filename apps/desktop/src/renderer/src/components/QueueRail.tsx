import { groupStartForIndex, SORT_MODES, viewCountForMode } from '@folio/core'
import type { DirEntry, ImageQueueItem } from '@folio/shared-types'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SORT_LABEL_KEYS, useT } from '../i18n'
import { loadFolder, refreshQueue } from '../lib/actions'
import { formatBytes, formatLabel, imageUrl } from '../lib/format'
import { useFolderStore } from '../stores/folderStore'
import { useMultiViewStore } from '../stores/multiViewStore'
import { useQueueStore } from '../stores/queueStore'
import {
  CheckIcon,
  ChevronRight,
  CornerUpLeftIcon,
  FolderIcon,
  FolderTreeIcon,
  RefreshIcon,
  SortIcon,
} from './icons'
import { ScrollOverlay } from './ScrollOverlay'

function HeaderButton({
  title,
  onClick,
  active,
  disabled,
  children,
}: {
  title: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-7 w-7 flex-none items-center justify-center rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent ${
        active
          ? 'bg-[#0A84FF]/20 text-[#0A84FF]'
          : 'text-[rgba(235,235,245,0.7)] hover:bg-white/[0.08]'
      }`}
    >
      {children}
    </button>
  )
}

/** Sort-order picker behind an icon (keeps the header compact): a dropdown of the sort modes. */
function SortMenu(): React.JSX.Element {
  const t = useT()
  const sortMode = useQueueStore((s) => s.sortMode)
  const setSortMode = useQueueStore((s) => s.setSortMode)
  const disabled = useQueueStore((s) => s.items.length === 0)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on a click outside the menu. Guarding on `ref.contains` (rather than closing on any
  // click) is what lets the same click that opens the menu not immediately close it again.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [open])

  return (
    <div ref={ref} className="relative flex-none">
      <HeaderButton
        title={t('toolbar.sortOrder')}
        onClick={() => setOpen((o) => !o)}
        active={open}
        disabled={disabled}
      >
        <SortIcon size={16} />
      </HeaderButton>
      {open && (
        <div className="absolute right-0 top-8 z-50 min-w-44 overflow-hidden rounded-lg border border-white/10 bg-[#2C2C2E] py-1 shadow-2xl">
          {SORT_MODES.map((m) => {
            const selected = m === sortMode
            return (
              <button
                type="button"
                key={m}
                onClick={() => {
                  setSortMode(m)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-[#0A84FF] hover:text-white ${
                  selected ? 'text-white' : 'text-[rgba(235,235,245,0.9)]'
                }`}
              >
                <span className="flex h-3.5 w-3.5 flex-none items-center justify-center">
                  {selected && <CheckIcon size={13} />}
                </span>
                {t(SORT_LABEL_KEYS[m])}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Collapsible folder browser: breadcrumb + a ".." row + subfolder rows with image counts. */
function FolderBrowser(): React.JSX.Element {
  const t = useT()
  const listing = useFolderStore((s) => s.listing)
  const loading = useFolderStore((s) => s.loading)
  const navigate = useFolderStore((s) => s.navigate)
  const queueDir = useQueueStore((s) => s.directory)

  // Clicking a folder loads its images when it has any; otherwise drill in. The chevron always drills.
  const onOpen = (d: DirEntry): void => {
    if (d.imageCount > 0) void loadFolder(d.path)
    else void navigate(d.path)
  }

  return (
    <div className="flex max-h-[42%] flex-none flex-col border-b border-white/[0.06] bg-[#121214]">
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        <FolderIcon size={13} className="flex-none text-[rgba(235,235,245,0.4)]" />
        <span className="truncate text-[11px] font-medium text-[rgba(235,235,245,0.6)]">
          {listing ? listing.name : '…'}
        </span>
      </div>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
        {listing?.parent && (
          <button
            type="button"
            onClick={() => void navigate(listing.parent as string)}
            className="mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-white/[0.05]"
          >
            <CornerUpLeftIcon size={15} className="flex-none text-[rgba(235,235,245,0.5)]" />
            <span className="font-mono text-[12px] text-[rgba(235,235,245,0.6)]">..</span>
          </button>
        )}
        {listing?.directories.map((d) => {
          const isCurrent = d.path === queueDir
          return (
            <div
              key={d.path}
              className={`mb-0.5 flex items-center rounded-md ${
                isCurrent
                  ? 'bg-[#0A84FF]/15 ring-1 ring-inset ring-[#0A84FF]/30'
                  : 'hover:bg-white/[0.05]'
              }`}
            >
              <button
                type="button"
                onClick={() => onOpen(d)}
                className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
              >
                <FolderIcon
                  size={15}
                  className={`flex-none ${d.imageCount > 0 ? 'text-[#0A84FF]' : 'text-[rgba(235,235,245,0.4)]'}`}
                />
                <span
                  className={`truncate text-[12px] ${isCurrent ? 'text-white' : 'text-[rgba(235,235,245,0.8)]'}`}
                >
                  {d.name}
                </span>
                {d.imageCount > 0 && (
                  <span className="ml-auto flex-none font-mono text-[10px] text-[rgba(235,235,245,0.4)]">
                    {d.imageCount}
                  </span>
                )}
              </button>
              {d.subdirCount > 0 && (
                <button
                  type="button"
                  title={d.name}
                  onClick={() => void navigate(d.path)}
                  className="flex h-7 w-6 flex-none items-center justify-center rounded-md text-[rgba(235,235,245,0.4)] hover:text-[rgba(235,235,245,0.8)]"
                >
                  <ChevronRight size={15} />
                </button>
              )}
            </div>
          )
        })}
        {listing && !listing.parent && listing.directories.length === 0 && (
          <div className="px-2 py-3 text-center text-[11px] text-[rgba(235,235,245,0.35)]">
            {loading ? t('folder.loading') : t('folder.empty')}
          </div>
        )}
        {listing && listing.directories.length === 0 && listing.parent && (
          <div className="px-2 py-3 text-center text-[11px] text-[rgba(235,235,245,0.35)]">
            {loading ? t('folder.loading') : t('folder.noSubfolders')}
          </div>
        )}
      </div>
    </div>
  )
}

/** Row thumbnail: lazily loads the cached gv-img://thumb variant, falling back to a format badge
 * (covers formats sharp can't decode, e.g. JXL, and any generation failure). `loading="lazy"` means
 * only on-screen rows trigger generation, so opening a huge folder doesn't request every thumb. */
function Thumb({ item }: { item: ImageQueueItem }): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  const badge = 'flex h-9 w-9 flex-none items-center justify-center rounded-md bg-white/[0.06]'
  if (failed) {
    return (
      <span className={`${badge} font-mono text-[9px] font-bold text-[rgba(235,235,245,0.6)]`}>
        {formatLabel(item).toUpperCase().slice(0, 4)}
      </span>
    )
  }
  return (
    <span className={`${badge} overflow-hidden`}>
      <img
        src={imageUrl('thumb', item.filePath)}
        alt=""
        loading="lazy"
        draggable={false}
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </span>
  )
}

/** Fixed row height (px) used for windowing — must match the rendered row's box. */
const ROW_H = 54
/** The scroll container's padding (p-1.5 = 6px), which offsets row positions in content space. */
const PAD = 6
/** Extra rows rendered above/below the viewport to avoid blank edges while scrolling. */
const OVERSCAN = 6

export function QueueRail(): React.JSX.Element {
  const t = useT()
  const items = useQueueStore((s) => s.items)
  const currentIndex = useQueueStore((s) => s.currentIndex)
  const select = useQueueStore((s) => s.select)
  const directory = useQueueStore((s) => s.directory)
  const mode = useMultiViewStore((s) => s.mode)
  const browseOpen = useFolderStore((s) => s.open)
  const toggleBrowse = useFolderStore((s) => s.toggle)
  const listRef = useRef<HTMLDivElement>(null)

  // Virtualize the list: render only the rows in (or near) the viewport. A big folder can hold
  // thousands of images, so mounting one <button> per item — each with a lazy thumbnail — would be
  // far too much DOM. We track scrollTop + viewport height and slice the visible window.
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(0)

  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return
    setViewportH(el.clientHeight)
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Range of indices in the currently displayed group (so multi-view shows which rows are on screen).
  const groupStart = groupStartForIndex(currentIndex, mode)
  const groupEnd = groupStart + viewCountForMode(mode)

  // Keep the selected row visible without scrollIntoView (it may not be mounted under windowing).
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const top = PAD + currentIndex * ROW_H
    if (top < el.scrollTop) el.scrollTop = top
    else if (top + ROW_H > el.scrollTop + el.clientHeight)
      el.scrollTop = top + ROW_H - el.clientHeight
  }, [currentIndex])

  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN)
  const end = Math.min(items.length, Math.ceil((scrollTop + viewportH) / ROW_H) + OVERSCAN)
  const visible = items.slice(start, end)

  return (
    <div className="flex w-72 flex-none flex-col border-r border-white/[0.06] bg-[#161618]">
      <div className="flex h-10 flex-none items-center gap-1.5 border-b border-white/[0.06] px-2.5">
        <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-[rgba(235,235,245,0.6)]">
            {t('queue.title')}
          </span>
          <span className="truncate font-mono text-[11px] text-[rgba(235,235,245,0.3)]">
            · {t('queue.images', { count: items.length })}
          </span>
        </span>
        <SortMenu />
        <HeaderButton
          title={t('queue.browseFolders')}
          onClick={() => void toggleBrowse()}
          active={browseOpen}
          disabled={!directory}
        >
          <FolderTreeIcon size={16} />
        </HeaderButton>
        <HeaderButton
          title={t('queue.refresh')}
          onClick={() => void refreshQueue()}
          disabled={!directory}
        >
          <RefreshIcon size={15} />
        </HeaderButton>
      </div>
      {browseOpen && <FolderBrowser />}
      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          className="no-scrollbar absolute inset-0 overflow-y-auto p-1.5"
        >
          {/* Full-height spacer keeps the scrollbar accurate; visible rows are absolutely placed. */}
          <div className="relative" style={{ height: items.length * ROW_H }}>
            {visible.map((it, k) => {
              const i = start + k
              const selected = i === currentIndex
              const inGroup = mode !== 'single' && i >= groupStart && i < groupEnd
              return (
                <button
                  type="button"
                  key={it.id}
                  onClick={() => select(i)}
                  style={{ top: i * ROW_H, height: ROW_H - 4 }}
                  className={`absolute inset-x-0 flex w-full items-center gap-2.5 rounded-lg px-2.5 text-left ${
                    selected
                      ? 'bg-[#0A84FF]/20 ring-1 ring-inset ring-[#0A84FF]/40'
                      : inGroup
                        ? 'bg-white/[0.06] ring-1 ring-inset ring-white/10'
                        : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <Thumb item={it} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className={`truncate text-[13px] ${selected ? 'text-white' : 'text-[rgba(235,235,245,0.85)]'}`}
                    >
                      {it.fileName}
                    </span>
                    <span className="truncate font-mono text-[11px] text-[rgba(235,235,245,0.3)]">
                      {formatBytes(it.size)} · {formatLabel(it)}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <ScrollOverlay scrollRef={listRef} />
      </div>
    </div>
  )
}
