import {
  type EraseField,
  groupStartForIndex,
  parseTagList,
  partitionExifByRule,
  presetRule,
  tagsForCategories,
  viewCountForMode,
} from '@folio/core'
import type { ErasePresetId, EraseRule, EraseTarget, ExifGroup } from '@folio/shared-types'
import { useEffect, useMemo, useState } from 'react'
import { tNow, useT } from '../i18n'
import { dirOf, useAutoModeStore } from '../stores/autoModeStore'
import { ERASE_CATEGORY_LIST, type EraseScope, useEraseStore } from '../stores/eraseStore'
import { useExifStore } from '../stores/exifStore'
import { useMultiViewStore } from '../stores/multiViewStore'
import { useQueueStore } from '../stores/queueStore'
import { useToastStore } from '../stores/toastStore'
import { useUiStore } from '../stores/uiStore'
import { CheckIcon, ShieldIcon } from './icons'

const PRESETS: ErasePresetId[] = ['privacy', 'share', 'full', 'copyright', 'custom']

type PreviewState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; groups: ExifGroup[] }

const baseName = (p: string): string => p.replaceAll('\\', '/').split('/').pop() ?? p

export function EraseDialog(): React.JSX.Element | null {
  const t = useT()
  const open = useEraseStore((s) => s.open)
  const filePath = useEraseStore((s) => s.filePath)
  const fileName = useEraseStore((s) => s.fileName)
  const preset = useEraseStore((s) => s.preset)
  const categories = useEraseStore((s) => s.categories)
  const customTags = useEraseStore((s) => s.customTags)
  const setCustomTags = useEraseStore((s) => s.setCustomTags)
  const exportNew = useEraseStore((s) => s.exportNew)
  const scope = useEraseStore((s) => s.scope)
  const setScope = useEraseStore((s) => s.setScope)
  const setPreset = useEraseStore((s) => s.setPreset)
  const toggleCategory = useEraseStore((s) => s.toggleCategory)
  const setExportNew = useEraseStore((s) => s.setExportNew)
  const close = useEraseStore((s) => s.close)

  const items = useQueueStore((s) => s.items)
  const currentIndex = useQueueStore((s) => s.currentIndex)
  const mode = useMultiViewStore((s) => s.mode)
  const showBatchTasks = useUiStore((s) => s.showBatchTasks)

  const [preview, setPreview] = useState<PreviewState>({ status: 'loading' })
  const [exportPath, setExportPath] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  /** Second-click arm for the destructive in-place batch overwrite (PRD §13.10). */
  const [armed, setArmed] = useState(false)

  // File paths the current multi-view group covers (group scope) and the whole folder (folder scope).
  const groupPaths = useMemo(() => {
    const start = groupStartForIndex(currentIndex, mode)
    return items.slice(start, start + viewCountForMode(mode)).map((it) => it.filePath)
  }, [items, currentIndex, mode])
  const folderPaths = useMemo(() => items.map((it) => it.filePath), [items])

  // Reset the destructive-overwrite arming whenever the relevant choice changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-arm only on these inputs
  useEffect(() => setArmed(false), [scope, exportNew, open])

  // Load current metadata (for the diff preview) and a free export path when the dialog opens.
  useEffect(() => {
    if (!open || !filePath) return
    let cancelled = false
    setPreview({ status: 'loading' })
    setExportPath(null)
    Promise.all([
      window.gv.metadata.read(filePath),
      window.gv.file.suggestExportPath(filePath, '-noexif'),
    ]).then(([meta, path]) => {
      if (cancelled) return
      setPreview(meta ? { status: 'loaded', groups: meta.groups } : { status: 'error' })
      setExportPath(path)
    })
    return () => {
      cancelled = true
    }
  }, [open, filePath])

  // Esc to cancel (when not mid-write).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !running) close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, running, close])

  const keepMode = preset === 'share' || preset === 'full'
  const parsedCustom = useMemo(() => parseTagList(customTags), [customTags])
  const rule: EraseRule = useMemo(() => {
    if (keepMode) return presetRule(preset)
    const checked = ERASE_CATEGORY_LIST.filter((c) => categories[c])
    const removeTags = [...new Set([...tagsForCategories(checked), ...parsedCustom.valid])]
    return { mode: 'remove_selected', removeTags, keepTags: [] }
  }, [keepMode, preset, categories, parsedCustom])

  const groups = preview.status === 'loaded' ? preview.groups : []
  const { removed, keptCount } = useMemo(() => partitionExifByRule(groups, rule), [groups, rule])

  if (!open || !filePath) return null

  const scopePaths: Record<EraseScope, string[]> = {
    image: [filePath],
    group: groupPaths,
    folder: folderPaths,
  }
  const targetPaths = scopePaths[scope]
  const isBatch = scope !== 'image'
  const fileCount = targetPaths.length

  const hasTags = keepMode || rule.removeTags.length > 0
  const canErase = !running && fileCount > 0 && hasTags

  // Single-image erase (the original path): run, verify, toast, refresh the drawer.
  const eraseSingle = async (): Promise<void> => {
    const target: EraseTarget =
      exportNew && exportPath ? { kind: 'export', targetPath: exportPath } : { kind: 'in_place' }
    setRunning(true)
    const res = await window.gv.metadata.erase(filePath, rule, target)
    setRunning(false)
    const toast = useToastStore.getState().show
    if (res.status === 'success') {
      if (res.stillPresent && res.stillPresent.length > 0) {
        toast(tNow('toast.eraseVerifyWarn', { count: res.stillPresent.length }), 'error')
      } else {
        toast(tNow(exportNew ? 'toast.eraseExported' : 'toast.eraseInPlace'), 'success')
      }
      if (!exportNew) useExifStore.getState().refresh() // re-read the drawer for in-place edits
      close()
      // Offer auto-mode for the rest of this folder (PRD §6.6) — first single erase per dir.
      useAutoModeStore.getState().offerAfterErase({
        filePath,
        fileName: fileName ?? filePath,
        directory: dirOf(filePath),
        rule,
        presetId: preset,
      })
    } else if (res.status === 'skipped') {
      toast(tNow('toast.eraseNothing'), 'error')
    } else {
      toast(tNow('toast.eraseFailed', { error: res.error ?? '' }), 'error')
    }
  }

  // Group/folder erase: hand off to the main-process scheduler and jump to the batch page.
  const eraseBatch = async (): Promise<void> => {
    // Destructive in-place batch requires a second click (PRD §13.10).
    if (!exportNew && !armed) {
      setArmed(true)
      return
    }
    await window.gv.task.startEraseBatch({
      filePaths: targetPaths,
      rule,
      output: exportNew ? 'export' : 'in_place',
      exportSuffix: '-noexif',
    })
    useToastStore.getState().show(tNow('toast.batchStarted', { count: fileCount }), 'info')
    showBatchTasks()
    close()
  }

  const onErase = (): Promise<void> => (isBatch ? eraseBatch() : eraseSingle())

  const confirmLabel = isBatch
    ? exportNew
      ? t('erase.confirmExportBatch', { count: fileCount })
      : armed
        ? t('erase.confirmOverwriteArm', { count: fileCount })
        : t('erase.confirmOverwriteBatch', { count: fileCount })
    : t(exportNew ? 'erase.confirmExport' : 'erase.confirmOverwrite')

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop click-to-dismiss; Esc and the Cancel button are the primary affordances
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-md"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !running) close()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="erase-title"
        className="flex max-h-[88vh] w-full max-w-[440px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1C1C1E] shadow-2xl"
      >
        {/* Header */}
        <div className="flex flex-none items-start gap-3.5 border-b border-white/[0.06] px-5 py-4">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#FF9F0A]/15 text-[#FF9F0A]">
            <ShieldIcon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="erase-title" className="text-[15px] font-semibold text-white">
              {t('erase.title')}
            </h2>
            <p className="mt-1 truncate font-mono text-[12px] text-[rgba(235,235,245,0.55)]">
              {fileName}
            </p>
          </div>
        </div>

        {/* Body (scrolls) */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* Scope — which images this rule applies to */}
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[rgba(235,235,245,0.45)]">
            {t('erase.scopeLabel')}
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <ScopeButton
              active={scope === 'image'}
              onClick={() => setScope('image')}
              label={t('erase.scope.image')}
            />
            {mode !== 'single' && (
              <ScopeButton
                active={scope === 'group'}
                onClick={() => setScope('group')}
                label={t('erase.scope.group', { count: groupPaths.length })}
              />
            )}
            <ScopeButton
              active={scope === 'folder'}
              onClick={() => setScope('folder')}
              label={t('erase.scope.folder', { count: folderPaths.length })}
            />
          </div>

          {/* Presets */}
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[rgba(235,235,245,0.45)]">
            {t('erase.presetLabel')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setPreset(p)}
                className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                  preset === p
                    ? 'bg-[#0A84FF]/20 text-[#0A84FF]'
                    : 'bg-white/[0.05] text-[rgba(235,235,245,0.8)] hover:bg-white/[0.09]'
                }`}
              >
                {t(`erase.preset.${p}`)}
              </button>
            ))}
          </div>

          {/* Category checkboxes (remove_selected presets) or keep-mode description */}
          {keepMode ? (
            <p className="mt-4 rounded-lg bg-white/[0.04] px-3.5 py-3 text-[13px] leading-5 text-[rgba(235,235,245,0.7)]">
              {t(preset === 'share' ? 'erase.preset.shareDesc' : 'erase.preset.fullDesc')}
            </p>
          ) : (
            <>
              <div className="mt-4 mb-1 text-[11px] font-semibold uppercase tracking-wide text-[rgba(235,235,245,0.45)]">
                {t('erase.removeLabel')}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {ERASE_CATEGORY_LIST.map((c) => (
                  <CategoryCheckbox
                    key={c}
                    label={t(`erase.cat.${c}`)}
                    checked={categories[c]}
                    onToggle={() => toggleCategory(c)}
                  />
                ))}
              </div>

              {/* Free-text extra tags (PRD §6.5 custom fields) — added on top of the categories. */}
              <div className="mt-3 mb-1 text-[11px] font-semibold uppercase tracking-wide text-[rgba(235,235,245,0.45)]">
                {t('erase.customLabel')}
              </div>
              <input
                type="text"
                value={customTags}
                onChange={(e) => setCustomTags(e.target.value)}
                placeholder={t('erase.customPlaceholder')}
                className="w-full rounded-lg bg-[#2C2C2E] px-3 py-2 font-mono text-[12px] text-white outline-none placeholder:font-sans placeholder:text-[rgba(235,235,245,0.35)]"
              />
              {parsedCustom.invalid.length > 0 && (
                <p className="mt-1 text-[11px] text-[#FF453A]">
                  {t('erase.customInvalid', { tags: parsedCustom.invalid.join(', ') })}
                </p>
              )}
            </>
          )}

          {/* Batch note (group/folder) — the diff below is per-file and can't preview a batch. */}
          {isBatch ? (
            <div className="mt-4 rounded-lg bg-[#161618] px-3.5 py-3 text-[13px] leading-5 text-[rgba(235,235,245,0.7)]">
              {t('erase.batchNote', { count: fileCount })}
            </div>
          ) : (
            /* Diff summary (single image) */
            <div className="mt-4 rounded-lg bg-[#161618] px-3.5 py-3">
              {preview.status === 'loading' ? (
                <span className="text-[13px] text-[rgba(235,235,245,0.5)]">
                  {t('exif.loading')}
                </span>
              ) : removed.length === 0 ? (
                <span className="text-[13px] text-[rgba(235,235,245,0.5)]">
                  {t('erase.noFields')}
                </span>
              ) : (
                <>
                  <div className="text-[13px] font-medium text-white">
                    {t('erase.summary', { removed: removed.length, kept: keptCount })}
                  </div>
                  <div className="mt-1.5 font-mono text-[11px] leading-4 text-[#FF453A]">
                    −{' '}
                    {removed
                      .slice(0, 8)
                      .map((r: EraseField) => r.key)
                      .join(', ')}
                    {removed.length > 8 ? ` +${removed.length - 8}` : ''}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Output target */}
          <div className="mt-4 flex flex-col gap-2">
            <RadioRow
              checked={exportNew}
              onSelect={() => setExportNew(true)}
              label={t('erase.exportNew')}
              hint={isBatch ? '→ *-noexif' : exportPath ? `→ ${baseName(exportPath)}` : undefined}
            />
            <RadioRow
              checked={!exportNew}
              onSelect={() => setExportNew(false)}
              label={t('erase.overwrite')}
              tone="danger"
            />
          </div>

          {/* In-place overwrite warning (destructive, no backup) */}
          {!exportNew && (
            <div className="mt-2 rounded-lg border border-[#FF453A]/30 bg-[#FF453A]/10 px-3.5 py-2.5">
              <p className="text-[12px] leading-4 text-[#FF6961]">{t('erase.overwriteWarn')}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-none justify-end gap-2 border-t border-white/[0.06] bg-[#161618] px-5 py-3">
          <button
            type="button"
            onClick={close}
            disabled={running}
            className="rounded-lg bg-white/[0.06] px-3.5 py-2 text-[13px] font-medium text-[rgba(235,235,245,0.86)] transition-colors hover:bg-white/[0.1] disabled:opacity-40"
          >
            {t('erase.cancel')}
          </button>
          <button
            type="button"
            onClick={onErase}
            disabled={!canErase}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold text-white transition-colors disabled:opacity-40 ${
              exportNew ? 'bg-[#0A84FF] hover:bg-[#3a9bff]' : 'bg-[#FF453A] hover:bg-[#ff5b51]'
            }`}
          >
            {running && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function ScopeButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
        active
          ? 'bg-[#0A84FF]/20 text-[#0A84FF]'
          : 'bg-white/[0.05] text-[rgba(235,235,245,0.8)] hover:bg-white/[0.09]'
      }`}
    >
      {label}
    </button>
  )
}

function Box({ checked }: { checked: boolean }): React.JSX.Element {
  return (
    <span
      className={`flex h-4 w-4 flex-none items-center justify-center rounded border transition-colors ${
        checked ? 'border-[#0A84FF] bg-[#0A84FF] text-white' : 'border-white/20 bg-white/[0.04]'
      }`}
    >
      {checked && <CheckIcon size={11} />}
    </span>
  )
}

function CategoryCheckbox({
  label,
  checked,
  onToggle,
}: {
  label: string
  checked: boolean
  onToggle: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-[rgba(235,235,245,0.85)] transition-colors hover:bg-white/[0.05]"
    >
      <Box checked={checked} />
      {label}
    </button>
  )
}

function RadioRow({
  checked,
  onSelect,
  label,
  hint,
  tone,
}: {
  checked: boolean
  onSelect: () => void
  label: string
  hint?: string
  tone?: 'danger'
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
        checked ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
      }`}
    >
      <span
        className={`flex h-4 w-4 flex-none items-center justify-center rounded-full border transition-colors ${
          checked
            ? tone === 'danger'
              ? 'border-[#FF453A]'
              : 'border-[#0A84FF]'
            : 'border-white/25'
        }`}
      >
        {checked && (
          <span
            className={`h-2 w-2 rounded-full ${tone === 'danger' ? 'bg-[#FF453A]' : 'bg-[#0A84FF]'}`}
          />
        )}
      </span>
      <span className="text-[13px] text-[rgba(235,235,245,0.9)]">{label}</span>
      {hint && (
        <span className="ml-auto truncate font-mono text-[11px] text-[rgba(235,235,245,0.45)]">
          {hint}
        </span>
      )}
    </button>
  )
}
