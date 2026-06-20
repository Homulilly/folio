import { canCancel, canPause, canResume, canRetry, errorLogs, taskProgress } from '@folio/core'
import type { Task, TaskStatus } from '@folio/shared-types'
import { type I18nKey, tNow, useT } from '../i18n'
import { useTaskStore } from '../stores/taskStore'
import { useToastStore } from '../stores/toastStore'
import { useUiStore } from '../stores/uiStore'
import {
  ChevronLeft,
  CloseIcon,
  CopyIcon,
  DownloadIcon,
  PauseIcon,
  PlayIcon,
  RotateIcon,
} from './icons'

const STATUS_KEY: Record<TaskStatus, I18nKey> = {
  pending: 'batch.status.pending',
  running: 'batch.status.running',
  paused: 'batch.status.paused',
  success: 'batch.status.success',
  failed: 'batch.status.failed',
  cancelled: 'batch.status.cancelled',
}

const STATUS_TONE: Record<TaskStatus, string> = {
  pending: 'text-[rgba(235,235,245,0.5)] bg-white/[0.06]',
  running: 'text-[#0A84FF] bg-[#0A84FF]/15',
  paused: 'text-[#FF9F0A] bg-[#FF9F0A]/15',
  success: 'text-[#32D7A0] bg-[#32D7A0]/15',
  failed: 'text-[#FF453A] bg-[#FF453A]/15',
  cancelled: 'text-[rgba(235,235,245,0.5)] bg-white/[0.06]',
}

const baseName = (p: string): string => p.replaceAll('\\', '/').split('/').pop() ?? p

/** Plain-text log for copying — mirrors the exported-file format. */
function formatTaskLog(task: Task, typeLabel: string): string {
  const head = [
    `Task: ${task.label ?? typeLabel}`,
    `Status: ${task.status}`,
    `Total: ${task.total}  Completed: ${task.completed}  Failed: ${task.failed}`,
    '',
  ]
  const lines = task.logs.map((l) => {
    const file = l.filePath ? ` ${l.filePath}` : ''
    return `[${new Date(l.at).toISOString()}] ${l.level.toUpperCase()}${file} — ${l.message}`
  })
  return [...head, ...lines].join('\n')
}

export function BatchTasksPage(): React.JSX.Element {
  const t = useT()
  const tasks = useTaskStore((s) => s.tasks)
  const showViewer = useUiStore((s) => s.showViewer)
  const hasFinished = tasks.some((task) => ['success', 'failed', 'cancelled'].includes(task.status))

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#0E0E0F]">
      <div className="flex h-12 flex-none items-center justify-between border-b border-white/[0.06] px-4">
        <button
          type="button"
          onClick={showViewer}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-[rgba(235,235,245,0.85)] transition-colors hover:bg-white/[0.08]"
        >
          <ChevronLeft size={16} />
          {t('toolbar.backToViewer')}
        </button>
        <span className="text-[13px] font-semibold text-white">{t('batch.title')}</span>
        <button
          type="button"
          onClick={() => void window.gv.task.clearFinished()}
          disabled={!hasFinished}
          className="rounded-lg px-2 py-1.5 text-[13px] text-[rgba(235,235,245,0.6)] transition-colors hover:bg-white/[0.08] disabled:opacity-30 disabled:hover:bg-transparent"
        >
          {t('batch.clearFinished')}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tasks.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[13px] text-[rgba(235,235,245,0.4)]">
            {t('batch.empty')}
          </div>
        ) : (
          <div className="mx-auto flex max-w-[640px] flex-col gap-3">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TaskCard({ task }: { task: Task }): React.JSX.Element {
  const t = useT()
  const toast = useToastStore((s) => s.show)
  const progress = taskProgress(task)
  const errors = errorLogs(task)
  const finished = ['success', 'failed', 'cancelled'].includes(task.status)
  const typeKey = `batch.type.${task.type}` as I18nKey
  const title = task.label ?? `${t(typeKey)} · ${t('queue.images', { count: task.total })}`

  const onRetry = async (): Promise<void> => {
    const id = await window.gv.task.retry(task.id)
    if (id) toast(tNow('toast.batchRetry', { count: task.failed }), 'info')
  }
  const onExportLog = async (): Promise<void> => {
    const path = await window.gv.task.exportLog(task.id)
    if (path) toast(tNow('toast.logExported'), 'success')
  }
  const onCopyLog = async (): Promise<void> => {
    await window.gv.clipboard.writeText(formatTaskLog(task, t(typeKey)))
    toast(tNow('toast.copied'), 'success')
  }

  return (
    <div
      className={`rounded-xl border border-white/[0.07] bg-[#1C1C1E] p-4 ${finished ? 'opacity-80' : ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-[14px] font-medium text-white">{title}</span>
        <span
          className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[task.status]}`}
        >
          {t(STATUS_KEY[task.status])}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${
            task.status === 'failed' ? 'bg-[#FF453A]' : 'bg-[#0A84FF]'
          }`}
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      <div className="mt-2 flex items-center gap-3 font-mono text-[12px] tabular-nums text-[rgba(235,235,245,0.6)]">
        <span>
          {task.completed + task.failed}/{task.total}
        </span>
        <span className="text-[#32D7A0]">{t('batch.completed', { count: task.completed })}</span>
        {task.failed > 0 && (
          <span className="text-[#FF453A]">{t('batch.failed', { count: task.failed })}</span>
        )}
      </div>

      {task.currentFile && (task.status === 'running' || task.status === 'paused') && (
        <div className="mt-1.5 truncate font-mono text-[12px] text-[rgba(235,235,245,0.45)]">
          {t('batch.current', { file: baseName(task.currentFile) })}
        </div>
      )}

      {/* Error list */}
      {errors.length > 0 && (
        <div className="mt-3 rounded-lg bg-[#161618] px-3 py-2.5">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#FF453A]">
            {t('batch.errors')} · {errors.length}
          </div>
          <div className="flex max-h-32 select-text flex-col gap-1 overflow-y-auto">
            {errors.map((log) => (
              <div key={`${log.at}-${log.filePath}`} className="font-mono text-[11px] leading-4">
                <span className="text-[#FF6961]">✗ </span>
                <span className="text-[rgba(235,235,245,0.7)]">
                  {log.filePath ? baseName(log.filePath) : ''}
                </span>
                <span className="text-[rgba(235,235,245,0.4)]"> — {log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {canPause(task) && (
          <CardButton
            onClick={() => void window.gv.task.pause(task.id)}
            icon={<PauseIcon size={14} />}
          >
            {t('batch.pause')}
          </CardButton>
        )}
        {canResume(task) && (
          <CardButton
            onClick={() => void window.gv.task.resume(task.id)}
            icon={<PlayIcon size={14} />}
          >
            {t('batch.resume')}
          </CardButton>
        )}
        {canCancel(task) && (
          <CardButton
            onClick={() => void window.gv.task.cancel(task.id)}
            icon={<CloseIcon size={14} />}
            tone="danger"
          >
            {t('batch.cancel')}
          </CardButton>
        )}
        {canRetry(task) && (
          <CardButton onClick={onRetry} icon={<RotateIcon size={14} />}>
            {t('batch.retry')}
          </CardButton>
        )}
        {task.logs.length > 0 && (
          <CardButton onClick={onCopyLog} icon={<CopyIcon size={14} />}>
            {t('batch.copyLog')}
          </CardButton>
        )}
        {task.logs.length > 0 && (
          <CardButton onClick={onExportLog} icon={<DownloadIcon size={14} />}>
            {t('batch.exportLog')}
          </CardButton>
        )}
      </div>
    </div>
  )
}

function CardButton({
  onClick,
  icon,
  tone,
  children,
}: {
  onClick: () => void
  icon: React.ReactNode
  tone?: 'danger'
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
        tone === 'danger'
          ? 'bg-[#FF453A]/15 text-[#FF6961] hover:bg-[#FF453A]/25'
          : 'bg-white/[0.06] text-[rgba(235,235,245,0.85)] hover:bg-white/[0.1]'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}
