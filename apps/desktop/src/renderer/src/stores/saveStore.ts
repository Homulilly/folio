import type { ConflictPolicy, NamingOptions } from '@folio/shared-types'
import { create } from 'zustand'

/** Which images a save applies to: just this one, the current multi-view group, or the folder. */
export type SaveScope = 'image' | 'group' | 'folder'

/** UI naming choice. `sequence` and `template` both resolve to a `template` NamingOptions. */
export type SaveNamingChoice = 'keep' | 'md5' | 'sha1' | 'sequence' | 'template'

/** The template the `sequence` choice uses. */
export const SEQUENCE_TEMPLATE = '{nr:001}.{ext}'

/**
 * The remembered "quick save" rule (PRD §6.7). Captured from the dialog on the first successful save
 * this session; the T shortcut / quick button then one-click saves the focused image with it.
 * In-memory only for now — persisting to settings.json is deferred to M7.
 */
export interface QuickSaveRule {
  targetDir: string
  naming: NamingOptions
  conflict: ConflictPolicy
}

interface SaveDialogState {
  open: boolean
  scope: SaveScope
  targetDir: string | null
  choice: SaveNamingChoice
  /** Custom template (edited when choice is `template`). */
  template: string
  conflict: ConflictPolicy
  /** Session quick-save rule; null until the first save establishes it. */
  quickRule: QuickSaveRule | null
  openDialog: () => void
  close: () => void
  setScope: (scope: SaveScope) => void
  setTargetDir: (dir: string | null) => void
  setChoice: (choice: SaveNamingChoice) => void
  setTemplate: (template: string) => void
  setConflict: (conflict: ConflictPolicy) => void
  setQuickRule: (rule: QuickSaveRule) => void
}

export const useSaveStore = create<SaveDialogState>((set) => ({
  open: false,
  scope: 'image',
  targetDir: null,
  choice: 'keep',
  template: '{name}_{nr:001}.{ext}',
  conflict: 'number',
  quickRule: null,
  openDialog: () => set({ open: true, scope: 'image' }),
  close: () => set({ open: false }),
  setScope: (scope) => set({ scope }),
  setTargetDir: (targetDir) => set({ targetDir }),
  setChoice: (choice) => set({ choice }),
  setTemplate: (template) => set({ template }),
  setConflict: (conflict) => set({ conflict }),
  setQuickRule: (quickRule) => set({ quickRule }),
}))

/** Resolve the UI naming choice into the IPC `NamingOptions`. */
export function namingFromChoice(choice: SaveNamingChoice, template: string): NamingOptions {
  switch (choice) {
    case 'keep':
      return { kind: 'keep' }
    case 'md5':
      return { kind: 'md5' }
    case 'sha1':
      return { kind: 'sha1' }
    case 'sequence':
      return { kind: 'template', template: SEQUENCE_TEMPLATE }
    case 'template':
      return { kind: 'template', template }
  }
}
