import type { DeleteOptions, RenameOptions } from '@folio/shared-types'
import { create } from 'zustand'

export type RenameMode = 'replace' | 'delete' | 'sequence'

interface RenameDialogState {
  open: boolean
  mode: RenameMode

  // Mode 1 — replace/delete characters.
  find: string
  replace: string
  useRegex: boolean
  caseSensitive: boolean
  includeExtension: boolean

  // Mode 2 — delete by position.
  deleteOp: DeleteOptions['op']
  start: number
  count: number
  marker: string

  // Mode 3 — sequence numbering.
  prefix: string
  separator: string
  seqStart: number
  padding: number
  keepExtension: boolean

  openDialog: () => void
  close: () => void
  setMode: (mode: RenameMode) => void
  set: (patch: Partial<RenameDialogState>) => void
}

const initial = {
  mode: 'replace' as RenameMode,
  find: '',
  replace: '',
  useRegex: false,
  caseSensitive: false,
  includeExtension: false,
  deleteOp: 'first' as DeleteOptions['op'],
  start: 1,
  count: 1,
  marker: '',
  prefix: 'Nr',
  separator: '_',
  seqStart: 1,
  padding: 3,
  keepExtension: true,
}

export const useRenameStore = create<RenameDialogState>((set) => ({
  open: false,
  ...initial,
  openDialog: () => set({ open: true }),
  close: () => set({ open: false }),
  setMode: (mode) => set({ mode }),
  set: (patch) => set(patch),
}))

/** Build the pure `RenameOptions` from the current dialog state. */
export function optionsFromState(s: RenameDialogState): RenameOptions {
  switch (s.mode) {
    case 'replace':
      return {
        kind: 'replace',
        find: s.find,
        replace: s.replace,
        useRegex: s.useRegex,
        caseSensitive: s.caseSensitive,
        includeExtension: s.includeExtension,
      }
    case 'delete':
      return {
        kind: 'delete',
        op: s.deleteOp,
        start: s.start,
        count: s.count,
        marker: s.marker,
        includeExtension: s.includeExtension,
      }
    case 'sequence':
      return {
        kind: 'sequence',
        prefix: s.prefix,
        separator: s.separator,
        start: s.seqStart,
        padding: s.padding,
        keepExtension: s.keepExtension,
      }
  }
}
