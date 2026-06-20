import {
  groupStartForIndex,
  nextGroupStart,
  previousGroupStart,
  viewCountForMode,
} from '@folio/core'
import type { MultiViewLayout, MultiViewMode } from '@folio/shared-types'
import { create } from 'zustand'
import { useQueueStore } from './queueStore'
import { useViewerStore } from './viewerStore'

const MODE_CYCLE: readonly MultiViewMode[] = ['single', 'dual', 'triple', 'quad']

/** Default layout when a mode is selected. */
const DEFAULT_LAYOUT: Record<MultiViewMode, MultiViewLayout> = {
  single: 'single',
  dual: 'dual_horizontal',
  triple: 'triple_main_left',
  quad: 'quad_grid',
}

/** Modes that offer more than one layout (cycled by {@link MultiViewStore.cycleLayout}). */
const LAYOUT_VARIANTS: Partial<Record<MultiViewMode, readonly MultiViewLayout[]>> = {
  dual: ['dual_horizontal', 'dual_vertical'],
  triple: ['triple_main_left', 'triple_equal_columns'],
}

/**
 * Presentation + navigation state for multi-image viewing. The focused image is owned by
 * queueStore.currentIndex — the *group* is derived from it (groupStartForIndex), so delete,
 * sort and queue-rail clicks recompute the group for free with no index to keep in sync.
 * Navigation methods here just drive queueStore.select(...).
 */
interface MultiViewStore {
  mode: MultiViewMode
  layout: MultiViewLayout
  /** When on, zoom applies to every slot together (compare clarity); otherwise only the focused slot. */
  syncZoom: boolean
  /** Wrap around past the queue ends when stepping groups (PRD "循环浏览"). */
  loopEnabled: boolean
  /** Enter temporarily blows the focused image up to a single full view; Esc returns. */
  expanded: boolean

  setMode: (mode: MultiViewMode) => void
  /** Seed persisted multi-view prefs on boot (mode + loop/sync), without the setMode side effects. */
  hydrate: (prefs: { mode: MultiViewMode; loopEnabled: boolean; syncZoom: boolean }) => void
  cycleMode: () => void
  cycleLayout: () => void
  /** Make slot `slot` (0-based) of the current group the focused image. No-op for blank slots. */
  focusSlot: (slot: number) => void
  focusNext: () => void
  focusPrev: () => void
  /** Step one image forward/back across the whole queue (within a group, then into the next). */
  nextImage: () => void
  prevImage: () => void
  nextGroup: () => void
  prevGroup: () => void
  toggleSync: () => void
  toggleLoop: () => void
  expand: () => void
  collapse: () => void
}

const queue = () => useQueueStore.getState()

export const useMultiViewStore = create<MultiViewStore>((set, get) => ({
  mode: 'single',
  layout: 'single',
  syncZoom: false,
  loopEnabled: false,
  expanded: false,

  setMode: (mode) => {
    // Realign so the previously focused image lands in slot 0 of its new group.
    queue().select(groupStartForIndex(queue().currentIndex, mode))
    // Start fresh at the fit scale. Grid fit is cell-relative (baseline 100%), single fit is
    // measured by the Canvas — so drop stale geometry when entering a grid.
    const v = useViewerStore.getState()
    if (mode === 'single') v.fitWindow()
    else v.fitForGrid()
    set({ mode, layout: DEFAULT_LAYOUT[mode], expanded: false })
    void window.gv.settings.update({ defaultMultiViewMode: mode })
  },

  // Boot-time seed: set mode + its default layout and the loop/sync prefs directly, without the
  // queue/viewer realignment setMode does (the queue is empty at boot).
  hydrate: ({ mode, loopEnabled, syncZoom }) =>
    set({ mode, layout: DEFAULT_LAYOUT[mode], loopEnabled, syncZoom }),

  cycleMode: () => {
    const i = MODE_CYCLE.indexOf(get().mode)
    get().setMode(MODE_CYCLE[(i + 1) % MODE_CYCLE.length] as MultiViewMode)
  },

  cycleLayout: () => {
    const { mode, layout } = get()
    const variants = LAYOUT_VARIANTS[mode]
    if (!variants) return
    const i = variants.indexOf(layout)
    set({ layout: variants[(i + 1) % variants.length] as MultiViewLayout })
  },

  focusSlot: (slot) => {
    const { items, currentIndex } = queue()
    const start = groupStartForIndex(currentIndex, get().mode)
    const target = start + slot
    if (slot >= 0 && slot < viewCountForMode(get().mode) && target < items.length) {
      queue().select(target)
    }
  },

  focusNext: () => {
    const { items, currentIndex } = queue()
    const { mode } = get()
    const start = groupStartForIndex(currentIndex, mode)
    const filled = Math.min(viewCountForMode(mode), items.length - start)
    if (filled <= 1) return
    const slot = (currentIndex - start + 1) % filled
    queue().select(start + slot)
  },

  focusPrev: () => {
    const { items, currentIndex } = queue()
    const { mode } = get()
    const start = groupStartForIndex(currentIndex, mode)
    const filled = Math.min(viewCountForMode(mode), items.length - start)
    if (filled <= 1) return
    const slot = (currentIndex - start - 1 + filled) % filled
    queue().select(start + slot)
  },

  // Single-image step. The group is derived from currentIndex, so stepping by 1 walks within
  // the current group and rolls into the adjacent group when crossing a boundary.
  nextImage: () => {
    const { items, currentIndex } = queue()
    if (currentIndex < items.length - 1) queue().select(currentIndex + 1)
    else if (get().loopEnabled) queue().select(0)
  },

  prevImage: () => {
    const { items, currentIndex } = queue()
    if (currentIndex > 0) queue().select(currentIndex - 1)
    else if (get().loopEnabled) queue().select(items.length - 1)
  },

  nextGroup: () => {
    const { items, currentIndex } = queue()
    const { mode, loopEnabled } = get()
    const start = groupStartForIndex(currentIndex, mode)
    queue().select(
      nextGroupStart({ startIndex: start, mode, total: items.length, loop: loopEnabled }),
    )
  },

  prevGroup: () => {
    const { items, currentIndex } = queue()
    const { mode, loopEnabled } = get()
    const start = groupStartForIndex(currentIndex, mode)
    queue().select(
      previousGroupStart({ startIndex: start, mode, total: items.length, loop: loopEnabled }),
    )
  },

  toggleSync: () =>
    set((s) => {
      const syncZoom = !s.syncZoom
      void window.gv.settings.update({ multiView: { syncZoom } })
      return { syncZoom }
    }),
  toggleLoop: () =>
    set((s) => {
      const loopEnabled = !s.loopEnabled
      void window.gv.settings.update({ multiView: { loopEnabled } })
      return { loopEnabled }
    }),
  // Switching between the grid and the focused single view always starts at the fit scale.
  expand: () => {
    if (get().mode === 'single') return
    useViewerStore.getState().fitWindow()
    set({ expanded: true })
  },
  collapse: () => {
    // Back to the grid — reset to the grid fit baseline (drops the expanded view's geometry).
    useViewerStore.getState().fitForGrid()
    set({ expanded: false })
  },
}))
