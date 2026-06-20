import {
  CONVERT_FORMATS,
  clampConvertOptions,
  formatSupportsAlpha,
  groupStartForIndex,
  outputNameForConvert,
  viewCountForMode,
} from '@folio/core'
import type { ConflictPolicy, ConvertRequest } from '@folio/shared-types'
import { useState } from 'react'
import { tNow, useT } from '../i18n'
import { useConvertStore } from '../stores/convertStore'
import { useMultiViewStore } from '../stores/multiViewStore'
import { useQueueStore } from '../stores/queueStore'
import { useToastStore } from '../stores/toastStore'
import { useUiStore } from '../stores/uiStore'
import { Field, inputClass, RadioRow, ScopeButton, Toggle } from './DialogPrimitives'
import { ConvertIcon, FolderIcon } from './icons'

const CONFLICTS: ConflictPolicy[] = ['number', 'skip', 'overwrite']
const baseName = (p: string): string => p.replaceAll('\\', '/').split('/').pop() ?? p

export function ConvertDialog(): React.JSX.Element | null {
  const t = useT()
  const open = useConvertStore((s) => s.open)
  const scope = useConvertStore((s) => s.scope)
  const options = useConvertStore((s) => s.options)
  const targetMode = useConvertStore((s) => s.targetMode)
  const targetDir = useConvertStore((s) => s.targetDir)
  const conflict = useConvertStore((s) => s.conflict)
  const setScope = useConvertStore((s) => s.setScope)
  const setFormat = useConvertStore((s) => s.setFormat)
  const setOptions = useConvertStore((s) => s.setOptions)
  const setTargetMode = useConvertStore((s) => s.setTargetMode)
  const setTargetDir = useConvertStore((s) => s.setTargetDir)
  const setConflict = useConvertStore((s) => s.setConflict)
  const close = useConvertStore((s) => s.close)

  const items = useQueueStore((s) => s.items)
  const currentIndex = useQueueStore((s) => s.currentIndex)
  const mode = useMultiViewStore((s) => s.mode)
  const showBatchTasks = useUiStore((s) => s.showBatchTasks)

  const [running, setRunning] = useState(false)

  if (!open) return null

  const groupStart = groupStartForIndex(currentIndex, mode)
  const groupIndices = items.map((_, i) => i).slice(groupStart, groupStart + viewCountForMode(mode))
  const scopeIndices: Record<string, number[]> = {
    image: currentIndex >= 0 ? [currentIndex] : [],
    group: groupIndices,
    folder: items.map((_, i) => i),
  }
  const indices = scopeIndices[scope] ?? []
  const isBatch = scope !== 'image'
  const fileCount = indices.length
  const format = options.format
  const alpha = formatSupportsAlpha(format)

  const canConvert = !running && fileCount > 0 && (targetMode === 'beside' || !!targetDir)

  const buildRequest = (): ConvertRequest => ({
    filePaths: indices.map((i) => items[i]?.filePath ?? '').filter(Boolean),
    targetDir: targetMode === 'folder' && targetDir ? targetDir : undefined,
    options: clampConvertOptions(options),
    conflict,
  })

  const chooseDir = async (): Promise<void> => {
    const dir = await window.gv.file.chooseDirectory()
    if (dir) {
      setTargetDir(dir)
      setTargetMode('folder')
    }
  }

  const onConvert = async (): Promise<void> => {
    if (!canConvert) return
    const toast = useToastStore.getState().show
    setRunning(true)
    try {
      if (isBatch) {
        await window.gv.task.startConvertBatch(buildRequest())
        toast(tNow('toast.convertBatchStarted', { count: fileCount }), 'info')
        showBatchTasks()
        close()
        return
      }
      const [res] = await window.gv.file.convert(buildRequest())
      if (!res || res.status === 'failed') {
        toast(tNow('toast.convertFailed', { error: res?.error ?? '' }), 'error')
      } else if (res.status === 'skipped') {
        toast(tNow('toast.convertSkipped'), 'error')
      } else {
        toast(tNow('toast.converted', { name: baseName(res.outputPath ?? '') }), 'success')
        // "转换后可打开目标文件夹" — reveal the new file (PRD §6.9).
        if (res.outputPath) void window.gv.file.showInFolder(res.outputPath)
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
        aria-labelledby="convert-title"
        className="flex max-h-[88vh] w-full max-w-[480px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1C1C1E] shadow-2xl"
      >
        {/* Header */}
        <div className="flex flex-none items-start gap-3.5 border-b border-white/[0.06] px-5 py-4">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#0A84FF]/15 text-[#0A84FF]">
            <ConvertIcon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="convert-title" className="text-[15px] font-semibold text-white">
              {t('convert.title')}
            </h2>
            <p className="mt-1 text-[12px] text-[rgba(235,235,245,0.55)]">
              {t('convert.subtitle')}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* Scope */}
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[rgba(235,235,245,0.45)]">
            {t('convert.scopeLabel')}
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <ScopeButton
              active={scope === 'image'}
              onClick={() => setScope('image')}
              label={t('convert.scope.image')}
            />
            {mode !== 'single' && (
              <ScopeButton
                active={scope === 'group'}
                onClick={() => setScope('group')}
                label={t('convert.scope.group', { count: groupIndices.length })}
              />
            )}
            <ScopeButton
              active={scope === 'folder'}
              onClick={() => setScope('folder')}
              label={t('convert.scope.folder', { count: items.length })}
            />
          </div>

          {/* Format */}
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[rgba(235,235,245,0.45)]">
            {t('convert.formatLabel')}
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {CONVERT_FORMATS.map((f) => (
              <ScopeButton
                key={f}
                active={format === f}
                onClick={() => setFormat(f)}
                label={f.toUpperCase()}
              />
            ))}
          </div>

          {/* Format parameters */}
          <div className="grid grid-cols-2 gap-3">
            {format !== 'png' && (
              <Field label={t('convert.quality')}>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className={inputClass}
                  value={options.quality}
                  onChange={(e) => setOptions({ quality: Number(e.target.value) })}
                />
              </Field>
            )}
            {format === 'png' && (
              <Field label={t('convert.compression')}>
                <input
                  type="number"
                  min={0}
                  max={9}
                  className={inputClass}
                  value={options.compressionLevel ?? 9}
                  onChange={(e) => setOptions({ compressionLevel: Number(e.target.value) })}
                />
              </Field>
            )}
            {format === 'avif' && (
              <Field label={t('convert.effort')}>
                <input
                  type="number"
                  min={0}
                  max={9}
                  className={inputClass}
                  value={options.effort ?? 4}
                  onChange={(e) => setOptions({ effort: Number(e.target.value) })}
                />
              </Field>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {format === 'jpeg' && (
              <Toggle
                checked={!!options.progressive}
                onChange={(v) => setOptions({ progressive: v })}
                label={t('convert.progressive')}
              />
            )}
            {format === 'webp' && (
              <Toggle
                checked={!!options.lossless}
                onChange={(v) => setOptions({ lossless: v })}
                label={t('convert.lossless')}
              />
            )}
            {alpha && (
              <Toggle
                checked={options.keepAlpha !== false}
                onChange={(v) => setOptions({ keepAlpha: v })}
                label={t('convert.keepAlpha')}
              />
            )}
            <Toggle
              checked={!!options.keepExif}
              onChange={(v) => setOptions({ keepExif: v })}
              label={t('convert.keepExif')}
            />
            <Toggle
              checked={!!options.keepIcc}
              onChange={(v) => setOptions({ keepIcc: v })}
              label={t('convert.keepIcc')}
            />
          </div>

          {/* Output target */}
          <div className="mt-4 mb-1 text-[11px] font-semibold uppercase tracking-wide text-[rgba(235,235,245,0.45)]">
            {t('convert.outputLabel')}
          </div>
          <div className="flex flex-col gap-2">
            <RadioRow
              checked={targetMode === 'beside'}
              onSelect={() => setTargetMode('beside')}
              label={t('convert.output.beside')}
            />
            <RadioRow
              checked={targetMode === 'folder'}
              onSelect={() => (targetDir ? setTargetMode('folder') : void chooseDir())}
              label={t('convert.output.folder')}
              hint={targetDir ? baseName(targetDir) : undefined}
            />
          </div>
          {targetMode === 'folder' && (
            <button
              type="button"
              onClick={chooseDir}
              className="mt-2 flex w-full items-center gap-2.5 rounded-lg bg-white/[0.05] px-3 py-2 text-left transition-colors hover:bg-white/[0.09]"
            >
              <FolderIcon size={16} />
              <span
                className={`min-w-0 flex-1 truncate font-mono text-[12px] ${
                  targetDir ? 'text-white' : 'text-[rgba(235,235,245,0.4)]'
                }`}
              >
                {targetDir ?? t('convert.choose')}
              </span>
              <span className="flex-none text-[12px] text-[#0A84FF]">{t('convert.choose')}</span>
            </button>
          )}

          {/* Conflict */}
          <div className="mt-4 mb-1 text-[11px] font-semibold uppercase tracking-wide text-[rgba(235,235,245,0.45)]">
            {t('convert.conflictLabel')}
          </div>
          <div className="flex flex-wrap gap-1.5">
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
            {t('convert.previewLabel', { count: fileCount })}
          </div>
          <div className="max-h-36 overflow-y-auto rounded-lg bg-[#161618] p-2">
            {indices.slice(0, 50).map((index) => (
              <div
                key={items[index]?.id ?? index}
                className="flex items-center gap-2 px-1.5 py-1 font-mono text-[11px]"
              >
                <span className="min-w-0 flex-1 truncate text-[rgba(235,235,245,0.45)]">
                  {items[index]?.fileName}
                </span>
                <span className="flex-none text-[rgba(235,235,245,0.3)]">→</span>
                <span className="min-w-0 flex-1 truncate text-[#32D7A0]">
                  {items[index] ? outputNameForConvert(items[index].fileName, format) : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-none justify-end gap-2 border-t border-white/[0.06] bg-[#161618] px-5 py-3">
          <button
            type="button"
            onClick={close}
            disabled={running}
            className="rounded-lg bg-white/[0.06] px-3.5 py-2 text-[13px] font-medium text-[rgba(235,235,245,0.86)] transition-colors hover:bg-white/[0.1] disabled:opacity-40"
          >
            {t('convert.cancel')}
          </button>
          <button
            type="button"
            onClick={onConvert}
            disabled={!canConvert}
            className="flex items-center gap-2 rounded-lg bg-[#0A84FF] px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#3a9bff] disabled:opacity-40"
          >
            {running && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            {isBatch
              ? t('convert.confirmBatch', { count: fileCount, format: format.toUpperCase() })
              : t('convert.confirm', { format: format.toUpperCase() })}
          </button>
        </div>
      </div>
    </div>
  )
}
