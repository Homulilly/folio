import {
  formatName,
  groupStartForIndex,
  type NamingContext,
  sanitizeFilename,
  templateNeedsHash,
  viewCountForMode,
} from '@folio/core'
import type { ConflictPolicy, SaveFileInput, SaveRequest } from '@folio/shared-types'
import { useMemo, useState } from 'react'
import { tNow, useT } from '../i18n'
import { useMultiViewStore } from '../stores/multiViewStore'
import { useQueueStore } from '../stores/queueStore'
import {
  namingFromChoice,
  type SaveNamingChoice,
  type SaveScope,
  useSaveStore,
} from '../stores/saveStore'
import { useToastStore } from '../stores/toastStore'
import { useUiStore } from '../stores/uiStore'
import { inputClass, RadioRow, ScopeButton } from './DialogPrimitives'
import { FolderIcon, SaveIcon } from './icons'

const NAMING_CHOICES: SaveNamingChoice[] = ['keep', 'md5', 'sha1', 'sequence', 'template']
const CONFLICTS: ConflictPolicy[] = ['number', 'skip', 'overwrite', 'md5_compare']

const baseName = (p: string): string => p.replaceAll('\\', '/').split('/').pop() ?? p
const stripExt = (fileName: string, ext: string): string =>
  ext && fileName.toLowerCase().endsWith(`.${ext}`)
    ? fileName.slice(0, -(ext.length + 1))
    : fileName

function nowStamp(): { date: string; time: string } {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    time: `${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`,
  }
}

export function SaveDialog(): React.JSX.Element | null {
  const t = useT()
  const open = useSaveStore((s) => s.open)
  const scope = useSaveStore((s) => s.scope)
  const targetDir = useSaveStore((s) => s.targetDir)
  const choice = useSaveStore((s) => s.choice)
  const template = useSaveStore((s) => s.template)
  const conflict = useSaveStore((s) => s.conflict)
  const setScope = useSaveStore((s) => s.setScope)
  const setTargetDir = useSaveStore((s) => s.setTargetDir)
  const setChoice = useSaveStore((s) => s.setChoice)
  const setTemplate = useSaveStore((s) => s.setTemplate)
  const setConflict = useSaveStore((s) => s.setConflict)
  const close = useSaveStore((s) => s.close)

  const items = useQueueStore((s) => s.items)
  const currentIndex = useQueueStore((s) => s.currentIndex)
  const directory = useQueueStore((s) => s.directory)
  const mode = useMultiViewStore((s) => s.mode)
  const showBatchTasks = useUiStore((s) => s.showBatchTasks)

  const [running, setRunning] = useState(false)
  const stamp = useMemo(() => nowStamp(), [])

  // Indices covered by each scope (kept as indices so we can build SaveFileInput with the queue
  // position for {index}).
  const groupIndices = useMemo(() => {
    const start = groupStartForIndex(currentIndex, mode)
    return items.map((_, i) => i).slice(start, start + viewCountForMode(mode))
  }, [items, currentIndex, mode])

  const scopeIndices: Record<SaveScope, number[]> = {
    image: currentIndex >= 0 ? [currentIndex] : [],
    group: groupIndices,
    folder: items.map((_, i) => i),
  }
  const indices = scopeIndices[scope]
  const isBatch = scope !== 'image'

  const naming = namingFromChoice(choice, template)

  // Per-file preview name (md5/sha1 shown as placeholders — the real hash is computed on save).
  const previewName = (index: number, ordinal: number): string => {
    const item = items[index]
    if (!item) return ''
    const ext = item.ext
    if (choice === 'keep') return item.fileName
    if (choice === 'md5' || choice === 'sha1') return ext ? `<${choice}>.${ext}` : `<${choice}>`
    const tpl = naming.kind === 'template' ? (naming.template ?? '') : ''
    const need = templateNeedsHash(tpl)
    const ctx: NamingContext = {
      name: stripExt(item.fileName, ext),
      ext,
      md5: need.md5 ? '<md5>' : undefined,
      sha1: need.sha1 ? '<sha1>' : undefined,
      date: stamp.date,
      time: stamp.time,
      width: item.width,
      height: item.height,
      index: index + 1,
      nr: ordinal + 1,
    }
    return sanitizeFilename(formatName(tpl, ctx)) || item.fileName
  }

  if (!open) return null

  const fileCount = indices.length
  const canSave = !running && fileCount > 0 && !!targetDir

  const buildRequest = (): SaveRequest => {
    const files: SaveFileInput[] = indices.map((i) => {
      const item = items[i]
      return {
        filePath: item?.filePath ?? '',
        index: i + 1,
        width: item?.width,
        height: item?.height,
      }
    })
    return { files, targetDir: targetDir as string, naming, conflict }
  }

  const chooseDir = async (): Promise<void> => {
    const dir = await window.gv.file.chooseDirectory()
    if (dir) setTargetDir(dir)
  }

  const onSave = async (): Promise<void> => {
    if (!canSave) return
    const toast = useToastStore.getState().show
    setRunning(true)
    try {
      if (isBatch) {
        await window.gv.task.startSaveBatch(buildRequest())
        toast(tNow('toast.saveBatchStarted', { count: fileCount }), 'info')
        showBatchTasks()
        close()
        return
      }
      const results = await window.gv.file.saveToTarget(buildRequest())
      const r = results[0]
      if (!r || r.status === 'failed') {
        toast(tNow('toast.saveFailed', { error: r?.error ?? '' }), 'error')
      } else if (r.status === 'skipped') {
        toast(tNow('toast.saveSkipped'), 'error')
      } else {
        toast(tNow('toast.saved', { name: baseName(r.outputPath ?? '') }), 'success')
        close()
      }
    } finally {
      setRunning(false)
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop click-to-dismiss; Esc/Cancel are primary
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-md"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !running) close()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-title"
        className="flex max-h-[88vh] w-full max-w-[460px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1C1C1E] shadow-2xl"
      >
        {/* Header */}
        <div className="flex flex-none items-start gap-3.5 border-b border-white/[0.06] px-5 py-4">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#0A84FF]/15 text-[#0A84FF]">
            <SaveIcon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="save-title" className="text-[15px] font-semibold text-white">
              {t('save.title')}
            </h2>
            <p className="mt-1 text-[12px] text-[rgba(235,235,245,0.55)]">{t('save.subtitle')}</p>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* Scope */}
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[rgba(235,235,245,0.45)]">
            {t('save.scopeLabel')}
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <ScopeButton
              active={scope === 'image'}
              onClick={() => setScope('image')}
              label={t('save.scope.image')}
            />
            {mode !== 'single' && (
              <ScopeButton
                active={scope === 'group'}
                onClick={() => setScope('group')}
                label={t('save.scope.group', { count: groupIndices.length })}
              />
            )}
            <ScopeButton
              active={scope === 'folder'}
              onClick={() => setScope('folder')}
              label={t('save.scope.folder', { count: items.length })}
            />
          </div>

          {/* Target folder */}
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[rgba(235,235,245,0.45)]">
            {t('save.targetLabel')}
          </div>
          <button
            type="button"
            onClick={chooseDir}
            className="mb-4 flex w-full items-center gap-2.5 rounded-lg bg-white/[0.05] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.09]"
          >
            <FolderIcon size={16} />
            <span
              className={`min-w-0 flex-1 truncate font-mono text-[12px] ${
                targetDir ? 'text-white' : 'text-[rgba(235,235,245,0.4)]'
              }`}
            >
              {targetDir ?? t('save.targetPlaceholder')}
            </span>
            <span className="flex-none text-[12px] text-[#0A84FF]">{t('save.choose')}</span>
          </button>

          {/* Naming */}
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[rgba(235,235,245,0.45)]">
            {t('save.namingLabel')}
          </div>
          <div className="flex flex-col gap-1">
            {NAMING_CHOICES.map((c) => (
              <RadioRow
                key={c}
                checked={choice === c}
                onSelect={() => setChoice(c)}
                label={t(`save.naming.${c}`)}
              />
            ))}
          </div>
          {choice === 'template' && (
            <div className="mt-2">
              <input
                type="text"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                placeholder="{name}_{nr:001}.{ext}"
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-[rgba(235,235,245,0.4)]">
                {t('save.tokensHint')}
              </p>
            </div>
          )}

          {/* Conflict */}
          <div className="mt-4 mb-1 text-[11px] font-semibold uppercase tracking-wide text-[rgba(235,235,245,0.45)]">
            {t('save.conflictLabel')}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {CONFLICTS.map((c) => (
              <ScopeButton
                key={c}
                active={conflict === c}
                onClick={() => setConflict(c)}
                label={t(`save.conflict.${c}`)}
              />
            ))}
          </div>

          {/* Preview */}
          <div className="mt-4 mb-1 text-[11px] font-semibold uppercase tracking-wide text-[rgba(235,235,245,0.45)]">
            {t('save.previewLabel', { count: fileCount })}
          </div>
          <div className="max-h-40 overflow-y-auto rounded-lg bg-[#161618] p-2">
            {indices.slice(0, 50).map((index, ordinal) => (
              <div
                key={items[index]?.id ?? index}
                className="flex items-center gap-2 px-1.5 py-1 font-mono text-[11px]"
              >
                <span className="min-w-0 flex-1 truncate text-[rgba(235,235,245,0.45)]">
                  {items[index]?.fileName}
                </span>
                <span className="flex-none text-[rgba(235,235,245,0.3)]">→</span>
                <span className="min-w-0 flex-1 truncate text-[#32D7A0]">
                  {previewName(index, ordinal)}
                </span>
              </div>
            ))}
            {fileCount > 50 && (
              <div className="px-1.5 py-1 text-[11px] text-[rgba(235,235,245,0.4)]">
                {t('save.previewMore', { count: fileCount - 50 })}
              </div>
            )}
          </div>

          {directory && targetDir === directory && (
            <p className="mt-2 text-[11px] text-[#FF9F0A]">{t('save.sameFolderWarn')}</p>
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
            {t('save.cancel')}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="flex items-center gap-2 rounded-lg bg-[#0A84FF] px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#3a9bff] disabled:opacity-40"
          >
            {running && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            {isBatch ? t('save.confirmBatch', { count: fileCount }) : t('save.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
