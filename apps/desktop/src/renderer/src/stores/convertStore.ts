import { defaultConvertOptions } from '@folio/core'
import type { ConflictPolicy, ConvertFormat, ConvertOptions } from '@folio/shared-types'
import { create } from 'zustand'

/** Which images a conversion applies to: just this one, the current multi-view group, or the folder. */
export type ConvertScope = 'image' | 'group' | 'folder'

/** Where converted files go: beside each original, or into a chosen folder. */
export type ConvertTargetMode = 'beside' | 'folder'

interface ConvertDialogState {
  open: boolean
  scope: ConvertScope
  options: ConvertOptions
  targetMode: ConvertTargetMode
  targetDir: string | null
  conflict: ConflictPolicy
  openDialog: () => void
  close: () => void
  setScope: (scope: ConvertScope) => void
  /** Pick a format — resets options to that format's defaults. */
  setFormat: (format: ConvertFormat) => void
  setOptions: (patch: Partial<ConvertOptions>) => void
  setTargetMode: (mode: ConvertTargetMode) => void
  setTargetDir: (dir: string | null) => void
  setConflict: (conflict: ConflictPolicy) => void
}

export const useConvertStore = create<ConvertDialogState>((set) => ({
  open: false,
  scope: 'image',
  options: defaultConvertOptions('webp'),
  targetMode: 'beside',
  targetDir: null,
  conflict: 'number',
  openDialog: () => set({ open: true, scope: 'image' }),
  close: () => set({ open: false }),
  setScope: (scope) => set({ scope }),
  setFormat: (format) => set({ options: defaultConvertOptions(format) }),
  setOptions: (patch) => set((s) => ({ options: { ...s.options, ...patch } })),
  setTargetMode: (targetMode) => set({ targetMode }),
  setTargetDir: (targetDir) => set({ targetDir }),
  setConflict: (conflict) => set({ conflict }),
}))
