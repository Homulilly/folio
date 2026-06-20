import { useEffect } from 'react'
import { tNow, useT } from '../i18n'
import { dirOf, useAutoModeStore } from '../stores/autoModeStore'
import { useQueueStore } from '../stores/queueStore'
import { useToastStore } from '../stores/toastStore'
import { useUiStore } from '../stores/uiStore'
import { ChevronRight, ImageIcon, ShieldIcon, ZapIcon } from './icons'

/**
 * Post-erase prompt (PRD §6.6): after the first single-image erase in a folder, offer to apply the
 * same rule more widely. All auto-mode operations export new files (never overwrite). The
 * persistent "save as default rule" option waits for settings.json (M7).
 */
export function AutoModePrompt(): React.JSX.Element | null {
  const t = useT()
  const open = useAutoModeStore((s) => s.promptOpen)
  const ctx = useAutoModeStore((s) => s.promptCtx)
  const dismiss = useAutoModeStore((s) => s.dismissPrompt)
  const enable = useAutoModeStore((s) => s.enableFromPrompt)
  const items = useQueueStore((s) => s.items)
  const showBatchTasks = useUiStore((s) => s.showBatchTasks)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dismiss])

  if (!open || !ctx) return null

  const folderPaths = items.map((it) => it.filePath).filter((p) => dirOf(p) === ctx.directory)

  const onFolder = async (): Promise<void> => {
    dismiss()
    await window.gv.task.startEraseBatch({
      filePaths: folderPaths,
      rule: ctx.rule,
      output: 'export',
      exportSuffix: '-noexif',
    })
    useToastStore.getState().show(tNow('toast.batchStarted', { count: folderPaths.length }), 'info')
    showBatchTasks()
  }

  const onSession = (): void => {
    enable()
    useToastStore.getState().show(tNow('auto.enabled'), 'success')
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click dismisses (= "this image only"); Esc also dismisses
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-md"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dismiss()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auto-title"
        className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1C1C1E] shadow-2xl"
      >
        <div className="flex items-start gap-3.5 border-b border-white/[0.06] px-5 py-4">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#32D7A0]/15 text-[#32D7A0]">
            <ShieldIcon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="auto-title" className="text-[15px] font-semibold text-white">
              {t('auto.title')}
            </h2>
            <p className="mt-1 truncate font-mono text-[12px] text-[rgba(235,235,245,0.55)]">
              {t('auto.done', { file: ctx.fileName, preset: t(`erase.preset.${ctx.presetId}`) })}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 p-3">
          <OptionRow
            icon={<ImageIcon size={18} />}
            label={t('auto.opt.imageOnly')}
            onClick={dismiss}
          />
          <OptionRow
            icon={<ChevronRight size={18} />}
            label={t('auto.opt.folder', { count: folderPaths.length })}
            onClick={onFolder}
          />
          <OptionRow
            icon={<ZapIcon size={18} />}
            label={t('auto.opt.session')}
            hint={t('auto.opt.sessionHint')}
            tone="accent"
            onClick={onSession}
          />
        </div>
      </div>
    </div>
  )
}

function OptionRow({
  icon,
  label,
  hint,
  tone,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  hint?: string
  tone?: 'accent'
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
    >
      <span
        className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg ${
          tone === 'accent'
            ? 'bg-[#0A84FF]/15 text-[#0A84FF]'
            : 'bg-white/[0.06] text-[rgba(235,235,245,0.7)]'
        }`}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] font-medium text-white">{label}</span>
        {hint && <span className="text-[11px] text-[rgba(235,235,245,0.45)]">{hint}</span>}
      </span>
    </button>
  )
}
