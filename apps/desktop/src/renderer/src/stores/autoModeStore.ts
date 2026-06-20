import type { ErasePresetId, EraseRule } from '@folio/shared-types'
import { create } from 'zustand'

/** Parent directory of an absolute path (forward-slash normalised). */
export const dirOf = (p: string): string =>
  p.replaceAll('\\', '/').split('/').slice(0, -1).join('/')

/** Context captured when a single-image erase succeeds — drives the post-erase prompt. */
export interface AutoEraseContext {
  filePath: string
  fileName: string
  directory: string
  rule: EraseRule
  presetId: ErasePresetId
}

/**
 * Session auto-mode (PRD §6.6, `session_directory` scope). All state is in-memory and cleared on
 * restart — persistent rules wait for `settings.json` (M7). When active, navigating to an
 * unprocessed image in `directory` triggers an export-new erase (see `useAutoErase`); auto-mode is
 * always non-destructive (export only) and can be turned off in one click.
 */
interface AutoModeState {
  // Active session rule.
  active: boolean
  directory: string | null
  rule: EraseRule | null
  presetId: ErasePresetId | null
  /** Originals already auto-processed this session (avoids re-firing / duplicate copies). */
  processed: string[]

  // Post-erase prompt.
  promptOpen: boolean
  promptCtx: AutoEraseContext | null
  /** Directories already offered the prompt this session (so we ask at most once per folder). */
  promptedDirs: string[]

  /** After a single-image erase, offer auto-mode — but only the first time per directory. */
  offerAfterErase: (ctx: AutoEraseContext) => void
  dismissPrompt: () => void
  /** Turn on session auto-mode for the prompt's directory + rule. */
  enableFromPrompt: () => void
  disable: () => void
  markProcessed: (filePath: string) => void
}

export const useAutoModeStore = create<AutoModeState>((set, get) => ({
  active: false,
  directory: null,
  rule: null,
  presetId: null,
  processed: [],
  promptOpen: false,
  promptCtx: null,
  promptedDirs: [],

  offerAfterErase: (ctx) => {
    const s = get()
    // Don't nag: skip if this directory was already offered, or auto-mode already covers it.
    if (s.promptedDirs.includes(ctx.directory)) return
    if (s.active && s.directory === ctx.directory) return
    set({ promptOpen: true, promptCtx: ctx, promptedDirs: [...s.promptedDirs, ctx.directory] })
  },
  dismissPrompt: () => set({ promptOpen: false, promptCtx: null }),
  enableFromPrompt: () => {
    const ctx = get().promptCtx
    if (!ctx) return
    set({
      active: true,
      directory: ctx.directory,
      rule: ctx.rule,
      presetId: ctx.presetId,
      processed: [ctx.filePath], // the image we just erased is already done
      promptOpen: false,
      promptCtx: null,
    })
  },
  disable: () => set({ active: false, directory: null, rule: null, presetId: null, processed: [] }),
  markProcessed: (filePath) =>
    set((s) => (s.processed.includes(filePath) ? s : { processed: [...s.processed, filePath] })),
}))
