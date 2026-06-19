import type { EraseCategory } from '@folio/core'
import type { ErasePresetId } from '@folio/shared-types'
import { create } from 'zustand'

export const ERASE_CATEGORY_LIST: EraseCategory[] = [
  'gps',
  'device',
  'datetime',
  'software',
  'thumbnail',
  'identity',
]

/** Which categories each remove-by-category preset pre-checks. share/full are keep-mode (no boxes). */
const PRESET_CATEGORIES: Partial<Record<ErasePresetId, EraseCategory[]>> = {
  privacy: ['gps', 'device', 'datetime', 'software', 'thumbnail'],
  copyright: ['gps', 'device'],
  custom: [],
}

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
  /** true = export a new file (safe default); false = overwrite the original in place. */
  exportNew: boolean
  /** When overwriting in place, keep ExifTool's `<name>_original` backup. */
  keepBackup: boolean
  openFor: (filePath: string, fileName: string) => void
  close: () => void
  setPreset: (preset: ErasePresetId) => void
  toggleCategory: (cat: EraseCategory) => void
  setExportNew: (v: boolean) => void
  setKeepBackup: (v: boolean) => void
}

export const useEraseStore = create<EraseDialogState>((set) => ({
  open: false,
  filePath: null,
  fileName: null,
  preset: 'privacy',
  categories: flagsFor(PRESET_CATEGORIES.privacy),
  exportNew: true,
  keepBackup: true,
  openFor: (filePath, fileName) =>
    set({
      open: true,
      filePath,
      fileName,
      preset: 'privacy',
      categories: flagsFor(PRESET_CATEGORIES.privacy),
      exportNew: true,
      keepBackup: true,
    }),
  close: () => set({ open: false }),
  setPreset: (preset) =>
    set(
      preset === 'share' || preset === 'full'
        ? { preset }
        : { preset, categories: flagsFor(PRESET_CATEGORIES[preset]) },
    ),
  toggleCategory: (cat) =>
    set((s) => ({ preset: 'custom', categories: { ...s.categories, [cat]: !s.categories[cat] } })),
  setExportNew: (exportNew) => set({ exportNew }),
  setKeepBackup: (keepBackup) => set({ keepBackup }),
}))
