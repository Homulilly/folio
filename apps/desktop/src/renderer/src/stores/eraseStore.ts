import { CATEGORY_PRESETS, ERASE_CATEGORY_ORDER, type EraseCategory } from '@folio/core'
import type { DefaultEraseRule, ErasePresetId } from '@folio/shared-types'
import { create } from 'zustand'

/** Display order of the category checkboxes (re-exported from core's single source of truth). */
export const ERASE_CATEGORY_LIST = ERASE_CATEGORY_ORDER

type CategoryFlags = Record<EraseCategory, boolean>

/** Which images an erase applies to: just this one, the current multi-view group, or the folder. */
export type EraseScope = 'image' | 'group' | 'folder'

const flagsFor = (cats: readonly EraseCategory[] = []): CategoryFlags =>
  Object.fromEntries(ERASE_CATEGORY_LIST.map((c) => [c, cats.includes(c)])) as CategoryFlags

const isCategory = (c: string): c is EraseCategory =>
  (ERASE_CATEGORY_LIST as readonly string[]).includes(c)

const activeCategories = (flags: CategoryFlags): EraseCategory[] =>
  ERASE_CATEGORY_LIST.filter((c) => flags[c])

/** Persist the current config as the remembered default rule (settings.json). */
function persistDefault(preset: ErasePresetId, flags: CategoryFlags, customTags: string): void {
  const rule: DefaultEraseRule = { preset, categories: activeCategories(flags), customTags }
  void window.gv.settings.update({ defaultErase: rule })
}

/** Erase dialog state. The effective rule is derived in the dialog from preset + categories. */
interface EraseDialogState {
  open: boolean
  filePath: string | null
  fileName: string | null
  scope: EraseScope
  preset: ErasePresetId
  categories: CategoryFlags
  /** Free-text extra tags (comma/space-separated) added on top of the checked categories. */
  customTags: string
  /** true = export a new file (safe default); false = overwrite the original in place. */
  exportNew: boolean
  /** Remembered default rule (from settings.json); the dialog pre-fills from it. */
  defaultRule: DefaultEraseRule | null
  openFor: (filePath: string, fileName: string) => void
  close: () => void
  setScope: (scope: EraseScope) => void
  setPreset: (preset: ErasePresetId) => void
  toggleCategory: (cat: EraseCategory) => void
  setCustomTags: (v: string) => void
  setExportNew: (v: boolean) => void
  /** Seed the remembered default rule on boot (see main.tsx). */
  hydrateDefault: (rule: DefaultEraseRule | null) => void
}

export const useEraseStore = create<EraseDialogState>((set) => ({
  open: false,
  filePath: null,
  fileName: null,
  scope: 'image',
  preset: 'privacy',
  categories: flagsFor(CATEGORY_PRESETS.privacy),
  customTags: '',
  exportNew: true,
  defaultRule: null,
  openFor: (filePath, fileName) =>
    set((s) => {
      const d = s.defaultRule
      return {
        open: true,
        filePath,
        fileName,
        scope: 'image',
        // Pre-fill from the remembered rule; fall back to the built-in Privacy preset.
        preset: d?.preset ?? 'privacy',
        categories: d
          ? flagsFor(d.categories.filter(isCategory))
          : flagsFor(CATEGORY_PRESETS.privacy),
        customTags: d?.customTags ?? '',
        exportNew: true, // always default to safe export; the in-place choice is never persisted
      }
    }),
  close: () => set({ open: false }),
  setScope: (scope) => set({ scope }),
  // setPreset/toggleCategory/setCustomTags also persist the config as the remembered default rule,
  // so the next dialog (and session) opens pre-filled with what you last used.
  setPreset: (preset) =>
    set((s) => {
      const categories =
        preset === 'share' || preset === 'full' ? s.categories : flagsFor(CATEGORY_PRESETS[preset])
      persistDefault(preset, categories, s.customTags)
      return { preset, categories }
    }),
  toggleCategory: (cat) =>
    set((s) => {
      const categories = { ...s.categories, [cat]: !s.categories[cat] }
      persistDefault('custom', categories, s.customTags)
      return { preset: 'custom' as ErasePresetId, categories }
    }),
  setCustomTags: (customTags) =>
    set((s) => {
      persistDefault(s.preset, s.categories, customTags)
      return { customTags }
    }),
  setExportNew: (exportNew) => set({ exportNew }),
  hydrateDefault: (defaultRule) => set({ defaultRule }),
}))
