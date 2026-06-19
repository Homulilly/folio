import { CATEGORY_PRESETS, ERASE_CATEGORY_ORDER, type EraseCategory } from '@folio/core'
import type { ErasePresetId } from '@folio/shared-types'
import { create } from 'zustand'

/** Display order of the category checkboxes (re-exported from core's single source of truth). */
export const ERASE_CATEGORY_LIST = ERASE_CATEGORY_ORDER

type CategoryFlags = Record<EraseCategory, boolean>

const flagsFor = (cats: EraseCategory[] = []): CategoryFlags =>
  Object.fromEntries(ERASE_CATEGORY_LIST.map((c) => [c, cats.includes(c)])) as CategoryFlags

/** Erase dialog state. The effective rule is derived in the dialog from preset + categories. */
interface EraseDialogState {
  open: boolean
  filePath: string | null
  fileName: string | null
  preset: ErasePresetId
  categories: CategoryFlags
  /** Free-text extra tags (comma/space-separated) added on top of the checked categories. */
  customTags: string
  /** true = export a new file (safe default); false = overwrite the original in place. */
  exportNew: boolean
  openFor: (filePath: string, fileName: string) => void
  close: () => void
  setPreset: (preset: ErasePresetId) => void
  toggleCategory: (cat: EraseCategory) => void
  setCustomTags: (v: string) => void
  setExportNew: (v: boolean) => void
}

export const useEraseStore = create<EraseDialogState>((set) => ({
  open: false,
  filePath: null,
  fileName: null,
  preset: 'privacy',
  categories: flagsFor(CATEGORY_PRESETS.privacy),
  customTags: '',
  exportNew: true,
  openFor: (filePath, fileName) =>
    set({
      open: true,
      filePath,
      fileName,
      preset: 'privacy',
      categories: flagsFor(CATEGORY_PRESETS.privacy),
      customTags: '',
      exportNew: true,
    }),
  close: () => set({ open: false }),
  setPreset: (preset) =>
    set(
      preset === 'share' || preset === 'full'
        ? { preset }
        : { preset, categories: flagsFor(CATEGORY_PRESETS[preset]) },
    ),
  toggleCategory: (cat) =>
    set((s) => ({ preset: 'custom', categories: { ...s.categories, [cat]: !s.categories[cat] } })),
  setCustomTags: (customTags) => set({ customTags }),
  setExportNew: (exportNew) => set({ exportNew }),
}))
