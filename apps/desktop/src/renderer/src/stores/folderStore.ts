import type { DirEntry, DirListing } from '@folio/shared-types'
import { create } from 'zustand'
import { useQueueStore } from './queueStore'

/**
 * Folder-browser state for the queue rail (PRD §6.1 "browse directories"). Browsing is decoupled
 * from the loaded queue: `browsePath` is wherever the user is looking, which defaults to the parent
 * of the open folder so its sibling folders are immediately visible. `nextFolder`, when set, drives
 * the "load next folder?" prompt offered after the last image.
 */
interface FolderState {
  open: boolean
  browsePath: string | null
  listing: DirListing | null
  loading: boolean
  /** Sibling folder offered after stepping past the last image; null when no prompt is showing. */
  nextFolder: DirEntry | null

  toggle: () => Promise<void>
  close: () => void
  navigate: (path: string) => Promise<void>
  /** Re-list the current browse path (e.g. after a refresh) without changing where you are. */
  refresh: () => Promise<void>
  /** Find the next sibling folder (after the open one) that has images and offer to load it. */
  offerNextFolder: () => Promise<void>
  dismissNextFolder: () => void
}

const listDirectory = (path: string) => window.gv.file.listDirectory(path)

export const useFolderStore = create<FolderState>((set, get) => ({
  open: false,
  browsePath: null,
  listing: null,
  loading: false,
  nextFolder: null,

  toggle: async () => {
    if (get().open) {
      set({ open: false })
      return
    }
    // Re-root on each open so the browser reflects the folder you're in now: list the parent of
    // the open folder so its siblings show (fall back to the folder itself at the filesystem root).
    set({ open: true, loading: true })
    const dir = useQueueStore.getState().directory
    if (!dir) {
      set({ loading: false })
      return
    }
    const here = await listDirectory(dir)
    await get().navigate(here?.parent ?? dir)
  },

  close: () => set({ open: false }),

  navigate: async (path) => {
    set({ loading: true })
    const listing = await listDirectory(path)
    set({ browsePath: listing?.path ?? path, listing, loading: false })
  },

  refresh: async () => {
    const path = get().browsePath
    if (path) await get().navigate(path)
  },

  offerNextFolder: async () => {
    const dir = useQueueStore.getState().directory
    if (!dir) return
    const here = await listDirectory(dir)
    if (!here?.parent) return
    const siblings = await listDirectory(here.parent)
    if (!siblings) return
    const idx = siblings.directories.findIndex((d) => d.path === dir)
    if (idx < 0) return
    const next = siblings.directories.slice(idx + 1).find((d) => d.imageCount > 0)
    if (next) set({ nextFolder: next })
  },

  dismissNextFolder: () => set({ nextFolder: null }),
}))
