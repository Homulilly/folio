import { planRename } from '@folio/core'
import type { DeleteOptions, RenameItemResult } from '@folio/shared-types'
import { useMemo, useState } from 'react'
import { tNow, useT } from '../i18n'
import { refreshQueue } from '../lib/actions'
import { useQueueStore } from '../stores/queueStore'
import { optionsFromState, type RenameMode, useRenameStore } from '../stores/renameStore'
import { useToastStore } from '../stores/toastStore'
import { Field, inputClass, ScopeButton } from './DialogPrimitives'
import { RenameIcon } from './icons'

const MODES: RenameMode[] = ['replace', 'delete', 'sequence']
const DELETE_OPS: DeleteOptions['op'][] = ['first', 'last', 'range', 'before', 'after']

/** A compact checkbox row. */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-[12px] text-[rgba(235,235,245,0.85)]"
    >
      <span
        className={`flex h-4 w-4 flex-none items-center justify-center rounded border text-[10px] transition-colors ${
          checked ? 'border-[#0A84FF] bg-[#0A84FF] text-white' : 'border-white/20 bg-white/[0.04]'
        }`}
      >
        {checked ? '✓' : ''}
      </span>
      {label}
    </button>
  )
}

export function RenameDialog(): React.JSX.Element | null {
  const t = useT()
  const s = useRenameStore()
  const open = s.open
  const set = s.set
  const close = s.close

  const items = useQueueStore((st) => st.items)
  const directory = useQueueStore((st) => st.directory)

  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<RenameItemResult[] | null>(null)

  const fileNames = useMemo(() => items.map((i) => i.fileName), [items])
  const options = optionsFromState(s)
  const plan = useMemo(() => planRename(fileNames, options), [fileNames, options])

  if (!open) return null

  const changedOps = plan.ops.filter((o) => o.changed)
  const canApply = !running && !plan.hasBlockingIssues && changedOps.length > 0 && !!directory

  const buildLog = (rs: RenameItemResult[]): string => {
    const head = [
      `Folder: ${directory ?? ''}`,
      `Total: ${rs.length}  OK: ${rs.filter((r) => r.status === 'success').length}  Failed: ${
        rs.filter((r) => r.status === 'failed').length
      }`,
      '',
    ]
    const lines = rs.map(
      (r) =>
        `${r.status === 'success' ? 'OK ' : 'ERR'}  ${r.from}  →  ${r.to}${r.error ? `  (${r.error})` : ''}`,
    )
    return [...head, ...lines].join('\n')
  }

  const onApply = async (): Promise<void> => {
    if (!canApply || !directory) return
    const toast = useToastStore.getState().show
    setRunning(true)
    try {
      const res = await window.gv.file.batchRename({
        directory,
        ops: changedOps.map((o) => ({ from: o.from, to: o.to })),
      })
      setResults(res.results)
      const failed = res.results.filter((r) => r.status === 'failed').length
      const ok = res.results.length - failed
      if (failed === 0) {
        toast(tNow('toast.renameDone', { count: ok }), 'success')
      } else {
        toast(tNow('toast.renameFailed', { count: failed }), 'error')
      }
      await refreshQueue()
    } finally {
      setRunning(false)
    }
  }

  const copyLog = (): void => {
    if (results) void window.gv.clipboard.writeText(buildLog(results))
    useToastStore.getState().show(tNow('toast.copied'), 'success')
  }
  const exportLog = (): void => {
    if (results) void window.gv.file.saveText('folio-rename.log', buildLog(results))
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
        aria-labelledby="rename-title"
        className="flex max-h-[88vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1C1C1E] shadow-2xl"
      >
        {/* Header */}
        <div className="flex flex-none items-start gap-3.5 border-b border-white/[0.06] px-5 py-4">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#0A84FF]/15 text-[#0A84FF]">
            <RenameIcon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="rename-title" className="text-[15px] font-semibold text-white">
              {t('rename.title')}
            </h2>
            <p className="mt-1 text-[12px] text-[rgba(235,235,245,0.55)]">
              {t('rename.subtitle', { count: items.length })}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* Mode */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {MODES.map((m) => (
              <ScopeButton
                key={m}
                active={s.mode === m}
                onClick={() => set({ mode: m })}
                label={t(`rename.mode.${m}`)}
              />
            ))}
          </div>

          {/* Mode options */}
          {s.mode === 'replace' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('rename.find')}>
                <input
                  className={inputClass}
                  value={s.find}
                  onChange={(e) => set({ find: e.target.value })}
                />
              </Field>
              <Field label={t('rename.replaceWith')}>
                <input
                  className={inputClass}
                  value={s.replace}
                  onChange={(e) => set({ replace: e.target.value })}
                />
              </Field>
              <div className="col-span-2 flex flex-wrap gap-4 pt-1">
                <Toggle
                  checked={s.useRegex}
                  onChange={(v) => set({ useRegex: v })}
                  label={t('rename.useRegex')}
                />
                <Toggle
                  checked={s.caseSensitive}
                  onChange={(v) => set({ caseSensitive: v })}
                  label={t('rename.caseSensitive')}
                />
                <Toggle
                  checked={s.includeExtension}
                  onChange={(v) => set({ includeExtension: v })}
                  label={t('rename.includeExtension')}
                />
              </div>
            </div>
          )}

          {s.mode === 'delete' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {DELETE_OPS.map((op) => (
                  <ScopeButton
                    key={op}
                    active={s.deleteOp === op}
                    onClick={() => set({ deleteOp: op })}
                    label={t(`rename.del.${op}`)}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {s.deleteOp === 'range' && (
                  <Field label={t('rename.start')}>
                    <input
                      type="number"
                      min={1}
                      className={inputClass}
                      value={s.start}
                      onChange={(e) => set({ start: Number(e.target.value) })}
                    />
                  </Field>
                )}
                {(s.deleteOp === 'range' || s.deleteOp === 'first' || s.deleteOp === 'last') && (
                  <Field label={t('rename.count')}>
                    <input
                      type="number"
                      min={0}
                      className={inputClass}
                      value={s.count}
                      onChange={(e) => set({ count: Number(e.target.value) })}
                    />
                  </Field>
                )}
                {(s.deleteOp === 'before' || s.deleteOp === 'after') && (
                  <Field label={t('rename.marker')}>
                    <input
                      className={inputClass}
                      value={s.marker}
                      onChange={(e) => set({ marker: e.target.value })}
                    />
                  </Field>
                )}
              </div>
              <Toggle
                checked={s.includeExtension}
                onChange={(v) => set({ includeExtension: v })}
                label={t('rename.includeExtension')}
              />
            </div>
          )}

          {s.mode === 'sequence' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('rename.prefix')}>
                <input
                  className={inputClass}
                  value={s.prefix}
                  onChange={(e) => set({ prefix: e.target.value })}
                />
              </Field>
              <Field label={t('rename.separator')}>
                <input
                  className={inputClass}
                  value={s.separator}
                  onChange={(e) => set({ separator: e.target.value })}
                />
              </Field>
              <Field label={t('rename.startNumber')}>
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={s.seqStart}
                  onChange={(e) => set({ seqStart: Number(e.target.value) })}
                />
              </Field>
              <Field label={t('rename.padding')}>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={s.padding}
                  onChange={(e) => set({ padding: Number(e.target.value) })}
                />
              </Field>
              <div className="col-span-2">
                <Toggle
                  checked={s.keepExtension}
                  onChange={(v) => set({ keepExtension: v })}
                  label={t('rename.keepExtension')}
                />
              </div>
            </div>
          )}

          {/* Preview / dry-run table */}
          <div className="mt-4 mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[rgba(235,235,245,0.45)]">
              {t('rename.previewLabel')}
            </span>
            <span className="text-[11px] text-[rgba(235,235,245,0.5)]">
              {t('rename.previewSummary', {
                changed: plan.counts.changed,
                unchanged: plan.counts.unchanged,
              })}
            </span>
          </div>
          <div className="max-h-56 overflow-y-auto rounded-lg bg-[#161618] p-2">
            {plan.ops.map((op) => {
              const result = results?.find((r) => r.from === op.from)
              const tone = op.issue
                ? 'text-[#FF453A]'
                : !op.changed
                  ? 'text-[rgba(235,235,245,0.35)]'
                  : 'text-[#32D7A0]'
              return (
                <div
                  key={op.from}
                  className="flex items-center gap-2 px-1.5 py-1 font-mono text-[11px]"
                >
                  <span className="min-w-0 flex-1 truncate text-[rgba(235,235,245,0.6)]">
                    {op.from}
                  </span>
                  <span className="flex-none text-[rgba(235,235,245,0.3)]">→</span>
                  <span className={`min-w-0 flex-1 truncate ${tone}`}>{op.to}</span>
                  {op.issue && (
                    <span className="flex-none text-[10px] text-[#FF453A]">
                      {t(`rename.issue.${op.issue}`)}
                    </span>
                  )}
                  {result?.status === 'failed' && (
                    <span className="flex-none text-[10px] text-[#FF453A]">✕</span>
                  )}
                </div>
              )
            })}
          </div>

          {plan.hasBlockingIssues && (
            <p className="mt-2 text-[11px] text-[#FF453A]">
              {t('rename.blocked', {
                illegal: plan.counts.illegal,
                duplicate: plan.counts.duplicate,
                collision: plan.counts.collision,
              })}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-none items-center gap-2 border-t border-white/[0.06] bg-[#161618] px-5 py-3">
          {results && (
            <>
              <button
                type="button"
                onClick={copyLog}
                className="rounded-lg bg-white/[0.06] px-3 py-2 text-[12px] text-[rgba(235,235,245,0.86)] transition-colors hover:bg-white/[0.1]"
              >
                {t('rename.copyLog')}
              </button>
              <button
                type="button"
                onClick={exportLog}
                className="rounded-lg bg-white/[0.06] px-3 py-2 text-[12px] text-[rgba(235,235,245,0.86)] transition-colors hover:bg-white/[0.1]"
              >
                {t('rename.exportLog')}
              </button>
            </>
          )}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={close}
              disabled={running}
              className="rounded-lg bg-white/[0.06] px-3.5 py-2 text-[13px] font-medium text-[rgba(235,235,245,0.86)] transition-colors hover:bg-white/[0.1] disabled:opacity-40"
            >
              {t('rename.cancel')}
            </button>
            <button
              type="button"
              onClick={onApply}
              disabled={!canApply}
              className="flex items-center gap-2 rounded-lg bg-[#0A84FF] px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#3a9bff] disabled:opacity-40"
            >
              {running && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}
              {t('rename.confirm', { count: changedOps.length })}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
