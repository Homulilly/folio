import type { ConflictPolicy, NamingOptions, QuickSaveRule } from '@folio/shared-types'
import { create } from 'zustand'

export type { QuickSaveRule } from '@folio/shared-types'

/** Which images a save applies to: just this one, the current multi-view group, or the folder. */
export type SaveScope = 'image' | 'group' | 'folder'

/** UI naming choice. `sequence` and `template` both resolve to a `template` NamingOptions. */
export type SaveNamingChoice = 'keep' | 'md5' | 'sha1' | 'sequence' | 'template'

/** The template the `sequence` choice uses. */
export const SEQUENCE_TEMPLATE = '{nr:001}.{ext}'

interface SaveDialogState {
  open: boolean
  scope: SaveScope
  targetDir: string | null
  choice: SaveNamingChoice
  /** Custom template (edited when choice is `template`). */
  template: string
  conflict: ConflictPolicy
  /** Quick-save rule; null until the first save establishes it. Persisted to settings.json. */
  quickRule: QuickSaveRule | null
  /** Open when the T shortcut needs the user to pick among several quick-save target folders. */
  quickPickerOpen: boolean
  openDialog: () => void
  close: () => void
  setScope: (scope: SaveScope) => void
  setTargetDir: (dir: string | null) => void
  setChoice: (choice: SaveNamingChoice) => void
  setTemplate: (template: string) => void
  setConflict: (conflict: ConflictPolicy) => void
  /** Establish the quick-save rule on the first dialog save (only when none is set yet). */
  establishQuickRule: (targetDir: string, naming: NamingOptions, conflict: ConflictPolicy) => void
  // Granular editors used by the settings page (each creates the rule if absent + persists).
  setQuickNaming: (naming: NamingOptions) => void
  setQuickConflict: (conflict: ConflictPolicy) => void
  addQuickTarget: (dir: string) => void
  removeQuickTarget: (dir: string) => void
  openQuickPicker: () => void
  closeQuickPicker: () => void
  /** Seed the persisted quick-save rule on boot (see main.tsx). */
  hydrateQuickRule: (rule: QuickSaveRule | null) => void
}

/** A blank rule to start from when the settings page edits before any rule exists. */
const EMPTY_QUICK_RULE: QuickSaveRule = {
  targetDirs: [],
  naming: { kind: 'keep' },
  conflict: 'number',
}

function persistQuick(rule: QuickSaveRule): void {
  void window.gv.settings.update({ quickSaveRule: rule })
}

export const useSaveStore = create<SaveDialogState>((set, get) => ({
  open: false,
  scope: 'image',
  targetDir: null,
  choice: 'keep',
  template: '{name}_{nr:001}.{ext}',
  conflict: 'number',
  quickRule: null,
  quickPickerOpen: false,
  openDialog: () => set({ open: true, scope: 'image' }),
  close: () => set({ open: false }),
  setScope: (scope) => set({ scope }),
  setTargetDir: (targetDir) => set({ targetDir }),
  setChoice: (choice) => set({ choice }),
  setTemplate: (template) => set({ template }),
  setConflict: (conflict) => set({ conflict }),
  establishQuickRule: (targetDir, naming, conflict) => {
    // First-use setup only — once a rule exists it's managed from the settings page.
    if (get().quickRule) return
    const rule: QuickSaveRule = { targetDirs: [targetDir], naming, conflict }
    set({ quickRule: rule })
    persistQuick(rule)
  },
  setQuickNaming: (naming) => {
    const rule = { ...(get().quickRule ?? EMPTY_QUICK_RULE), naming }
    set({ quickRule: rule })
    persistQuick(rule)
  },
  setQuickConflict: (conflict) => {
    const rule = { ...(get().quickRule ?? EMPTY_QUICK_RULE), conflict }
    set({ quickRule: rule })
    persistQuick(rule)
  },
  addQuickTarget: (dir) => {
    const cur = get().quickRule ?? EMPTY_QUICK_RULE
    if (cur.targetDirs.includes(dir)) return
    const rule = { ...cur, targetDirs: [...cur.targetDirs, dir] }
    set({ quickRule: rule })
    persistQuick(rule)
  },
  removeQuickTarget: (dir) => {
    const cur = get().quickRule
    if (!cur) return
    const rule = { ...cur, targetDirs: cur.targetDirs.filter((d) => d !== dir) }
    set({ quickRule: rule })
    persistQuick(rule)
  },
  openQuickPicker: () => set({ quickPickerOpen: true }),
  closeQuickPicker: () => set({ quickPickerOpen: false }),
  hydrateQuickRule: (quickRule) => set({ quickRule }),
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

/** Reverse of {@link namingFromChoice}: derive the UI choice (+ template text) from NamingOptions. */
export function choiceFromNaming(naming: NamingOptions): {
  choice: SaveNamingChoice
  template: string
} {
  if (naming.kind === 'keep') return { choice: 'keep', template: '' }
  if (naming.kind === 'md5') return { choice: 'md5', template: '' }
  if (naming.kind === 'sha1') return { choice: 'sha1', template: '' }
  const template = naming.template ?? ''
  if (template === SEQUENCE_TEMPLATE) return { choice: 'sequence', template: '' }
  return { choice: 'template', template }
}
