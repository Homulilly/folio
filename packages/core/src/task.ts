import type { Task, TaskLog, TaskStatus, TaskType } from '@folio/shared-types'

// Pure task state machine (PRD §9.3). The main-process Task Scheduler owns execution (running the
// actual erase/convert/… work, streaming progress over IPC); this module owns the *rules*: which
// status transitions are legal, how progress and the failed/completed counts accumulate, and how a
// task finalises. Every helper is immutable — it returns a new Task — so the scheduler can keep a
// single source of truth and the renderer can diff. Timestamps are passed in (`now`) because the
// core package must stay free of side effects (and `Date.now()` is unavailable in some hosts).

/** Statuses from which no further transition is allowed. */
const TERMINAL: readonly TaskStatus[] = ['success', 'failed', 'cancelled']

export function isTerminal(status: TaskStatus): boolean {
  return TERMINAL.includes(status)
}

/** Legal status transitions. A batch starts `pending`, runs, may pause/resume, then finalises. */
const TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  pending: ['running', 'cancelled'],
  running: ['paused', 'success', 'failed', 'cancelled'],
  paused: ['running', 'cancelled'],
  success: [],
  failed: [],
  cancelled: [],
}

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export interface CreateTaskInput {
  id: string
  type: TaskType
  total: number
  now: number
  label?: string
}

/** Create a fresh `pending` task. */
export function createTask({ id, type, total, now, label }: CreateTaskInput): Task {
  return {
    id,
    type,
    status: 'pending',
    total,
    completed: 0,
    failed: 0,
    createdAt: now,
    updatedAt: now,
    logs: [],
    ...(label !== undefined ? { label } : {}),
  }
}

/** Move a task to a new status, enforcing the transition table. Throws on an illegal move so
 * scheduler bugs surface in tests rather than producing a nonsensical state. */
export function setStatus(task: Task, status: TaskStatus, now: number): Task {
  if (status === task.status) return { ...task, updatedAt: now }
  if (!canTransition(task.status, status)) {
    throw new Error(`Illegal task transition: ${task.status} → ${status}`)
  }
  return { ...task, status, updatedAt: now }
}

export function appendLog(task: Task, log: TaskLog): Task {
  return { ...task, logs: [...task.logs, log], updatedAt: log.at }
}

/** Mark which file is being processed now (shown on the batch page). */
export function setCurrentFile(task: Task, filePath: string | undefined, now: number): Task {
  return { ...task, currentFile: filePath, updatedAt: now }
}

export interface ItemResult {
  ok: boolean
  filePath: string
  message?: string
  now: number
}

/** Record one file's outcome: bump completed/failed and append a matching log line. */
export function recordResult(task: Task, result: ItemResult): Task {
  const { ok, filePath, message, now } = result
  const log: TaskLog = {
    at: now,
    level: ok ? 'info' : 'error',
    message: message ?? (ok ? 'done' : 'failed'),
    filePath,
  }
  return {
    ...task,
    completed: ok ? task.completed + 1 : task.completed,
    failed: ok ? task.failed : task.failed + 1,
    logs: [...task.logs, log],
    updatedAt: now,
  }
}

export const startTask = (task: Task, now: number): Task => setStatus(task, 'running', now)
export const pauseTask = (task: Task, now: number): Task => setStatus(task, 'paused', now)
export const resumeTask = (task: Task, now: number): Task => setStatus(task, 'running', now)

/** Cancel a task and clear the current-file marker. */
export function cancelTask(task: Task, now: number): Task {
  return { ...setStatus(task, 'cancelled', now), currentFile: undefined }
}

/** Finalise a run that processed every item: `failed` if all items failed, else `success`
 * (partial failures are surfaced via the error log, not the overall status). */
export function finalizeTask(task: Task, now: number): Task {
  const allFailed = task.total > 0 && task.failed >= task.total
  return { ...setStatus(task, allFailed ? 'failed' : 'success', now), currentFile: undefined }
}

// ---- Derived views (for the batch page) ----

/** Processed fraction in [0,1]. A zero-item task counts as fully done. */
export function taskProgress(task: Task): number {
  if (task.total <= 0) return 1
  return Math.min(1, (task.completed + task.failed) / task.total)
}

/** Only the error log lines — the batch page's error list (PRD §8.4). */
export function errorLogs(task: Task): TaskLog[] {
  return task.logs.filter((l) => l.level === 'error')
}

/** Distinct file paths that failed — the retry set the scheduler re-runs (PRD §9.3 retry). */
export function failedFiles(task: Task): string[] {
  const seen = new Set<string>()
  for (const l of task.logs) if (l.level === 'error' && l.filePath) seen.add(l.filePath)
  return [...seen]
}

export const canPause = (task: Task): boolean => task.status === 'running'
export const canResume = (task: Task): boolean => task.status === 'paused'
export const canCancel = (task: Task): boolean => !isTerminal(task.status)
export const canRetry = (task: Task): boolean =>
  // A restored task (loaded from history) has no runtime control, so it can't be re-run.
  !task.restored && (task.status === 'failed' || (task.status === 'cancelled' && task.failed > 0))
