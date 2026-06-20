import { randomUUID } from 'node:crypto'
import {
  appendLog,
  cancelTask,
  createTask,
  failedFiles,
  finalizeTask,
  isTerminal,
  pauseTask,
  recordResult,
  resumeTask,
  setCurrentFile,
  startTask,
} from '@folio/core'
import type {
  BatchEraseRequest,
  ConvertRequest,
  EraseRule,
  EraseTarget,
  SaveRequest,
  Task,
  TaskType,
} from '@folio/shared-types'
import { convertFile } from './convert'
import { eraseMetadata } from './exiftool'
import { suggestExportPath } from './paths'
import { nowStamp, type SaveStamp, saveFile } from './save'

// Main-process Task Scheduler (PRD §9.3). Owns task execution and lifecycle; the pure transition
// rules / counters live in @folio/core. A batch runs files sequentially (the per-file work —
// ExifTool writes / hashing+copy — can't be interrupted mid-file), checking pause/cancel between
// files. Every state change pushes the full task list to the renderer via `emit`.
//
// Batches are generic: each `Control` carries a per-file `execute` closure plus a `spawn` that
// re-runs a subset (for retry). Erase and save differ only in those two closures.

interface ItemOutcome {
  ok: boolean
  message?: string
  warn?: string
}

/** Per-task runtime control: pause/cancel flags + the closures that run and retry the batch. */
interface Control {
  paused: boolean
  cancelled: boolean
  /** Resolvers for a runner currently parked in `waitIfPaused`. */
  waiters: Array<() => void>
  type: TaskType
  files: string[]
  label?: string
  /** Process one file; map its outcome to a success flag + log message (+ optional soft warning). */
  execute: (filePath: string) => Promise<ItemOutcome>
  /** Re-run a subset of files as a fresh batch; returns the new task id. */
  spawn: (files: string[]) => string
}

export class TaskScheduler {
  private tasks = new Map<string, Task>()
  private controls = new Map<string, Control>()
  private emit: () => void = () => {}

  /** Wire the renderer push channel. `fn` is called after every task mutation. */
  setEmitter(fn: () => void): void {
    this.emit = fn
  }

  /** All tasks, newest first (matches the batch page's stacking order). */
  list(): Task[] {
    return [...this.tasks.values()].sort((a, b) => b.createdAt - a.createdAt)
  }

  private update(task: Task): void {
    this.tasks.set(task.id, task)
    this.emit()
  }

  private get(id: string): Task | undefined {
    return this.tasks.get(id)
  }

  /** Register a batch + its control, create the pending task, and kick off the runner. */
  private launch(control: Control): string {
    const id = randomUUID()
    this.controls.set(id, control)
    this.tasks.set(
      id,
      createTask({
        id,
        type: control.type,
        total: control.files.length,
        now: Date.now(),
        label: control.label,
      }),
    )
    this.emit()
    void this.run(id)
    return id
  }

  // ---- Erase batch (M4) ----

  startEraseBatch(request: BatchEraseRequest): string {
    const exportSuffix = request.exportSuffix ?? '-noexif'
    return this.launch({
      paused: false,
      cancelled: false,
      waiters: [],
      type: 'metadata_remove',
      files: request.filePaths,
      label: request.label,
      execute: (filePath) => this.eraseOne(filePath, request.rule, request.output, exportSuffix),
      spawn: (files) =>
        this.startEraseBatch({
          filePaths: files,
          rule: request.rule,
          output: request.output,
          exportSuffix,
          label: request.label,
        }),
    })
  }

  /** Erase one file; map the result to a success flag + a log message. */
  private async eraseOne(
    filePath: string,
    rule: EraseRule,
    output: 'export' | 'in_place',
    exportSuffix: string,
  ): Promise<ItemOutcome> {
    try {
      const target: EraseTarget =
        output === 'in_place'
          ? { kind: 'in_place' }
          : { kind: 'export', targetPath: await suggestExportPath(filePath, exportSuffix) }
      const res = await eraseMetadata(filePath, rule, target)
      if (res.status !== 'success') return { ok: false, message: res.error ?? res.status }
      // The write succeeded; a residual is a non-fatal verification warning (the file is still done).
      if (res.stillPresent && res.stillPresent.length > 0) {
        return {
          ok: true,
          message: res.outputPath,
          warn: `${res.stillPresent.length} tag(s) may remain: ${res.stillPresent.join(', ')}`,
        }
      }
      return { ok: true, message: res.outputPath }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) }
    }
  }

  // ---- Save-to-target batch (M5) ----

  startSaveBatch(request: SaveRequest): string {
    const stamp: SaveStamp = nowStamp()
    // filePath → its SaveFileInput + 0-based ordinal (drives `{nr}` and conflict naming).
    const byPath = new Map(
      request.files.map((input, ordinal) => [input.filePath, { input, ordinal }]),
    )
    return this.launch({
      paused: false,
      cancelled: false,
      waiters: [],
      type: 'save',
      files: request.files.map((f) => f.filePath),
      label: request.label,
      execute: (filePath) => this.saveOne(filePath, byPath, request, stamp),
      spawn: (files) =>
        this.startSaveBatch({
          ...request,
          files: request.files.filter((f) => files.includes(f.filePath)),
        }),
    })
  }

  private async saveOne(
    filePath: string,
    byPath: Map<string, { input: SaveRequest['files'][number]; ordinal: number }>,
    request: SaveRequest,
    stamp: SaveStamp,
  ): Promise<ItemOutcome> {
    const entry = byPath.get(filePath)
    if (!entry) return { ok: false, message: 'Unknown file' }
    const res = await saveFile(
      entry.input,
      entry.ordinal,
      request.targetDir,
      request.naming,
      request.conflict,
      stamp,
    )
    if (res.status === 'failed') return { ok: false, message: res.error ?? 'failed' }
    if (res.status === 'skipped') return { ok: true, message: `skipped (${res.outputPath ?? ''})` }
    return { ok: true, message: res.outputPath }
  }

  // ---- Format-conversion batch (M6) ----

  startConvertBatch(request: ConvertRequest): string {
    return this.launch({
      paused: false,
      cancelled: false,
      waiters: [],
      type: 'convert',
      files: request.filePaths,
      label: request.label,
      execute: (filePath) => this.convertOne(filePath, request),
      spawn: (files) => this.startConvertBatch({ ...request, filePaths: files }),
    })
  }

  private async convertOne(filePath: string, request: ConvertRequest): Promise<ItemOutcome> {
    const res = await convertFile(filePath, request.targetDir, request.options, request.conflict)
    if (res.status === 'failed') return { ok: false, message: res.error ?? 'failed' }
    if (res.status === 'skipped') return { ok: true, message: `skipped (${res.outputPath ?? ''})` }
    return { ok: true, message: res.outputPath }
  }

  // ---- Generic run loop / lifecycle ----

  private async run(id: string): Promise<void> {
    const control = this.controls.get(id)
    const initial = this.get(id)
    if (!control || !initial) return
    this.update(startTask(initial, Date.now()))

    for (const filePath of control.files) {
      if (control.cancelled) break
      await this.waitIfPaused(control)
      if (control.cancelled) break

      this.update(setCurrentFile(this.get(id) as Task, filePath, Date.now()))

      const { ok, message, warn } = await control.execute(filePath)
      let task = recordResult(this.get(id) as Task, { ok, filePath, message, now: Date.now() })
      if (warn) task = appendLog(task, { at: Date.now(), level: 'warn', message: warn, filePath })
      this.update(task)
    }

    const last = this.get(id) as Task
    // If cancelled, cancelTask already set the terminal status; just clear the current-file line.
    this.update(
      control.cancelled
        ? setCurrentFile(last, undefined, Date.now())
        : finalizeTask(last, Date.now()),
    )
  }

  /** Park the runner while paused; resolves on resume or cancel. */
  private waitIfPaused(control: Control): Promise<void> {
    if (!control.paused || control.cancelled) return Promise.resolve()
    return new Promise<void>((resolve) => control.waiters.push(resolve))
  }

  pause(id: string): void {
    const control = this.controls.get(id)
    const task = this.get(id)
    if (!control || !task || task.status !== 'running') return
    control.paused = true
    this.update(pauseTask(task, Date.now()))
  }

  resume(id: string): void {
    const control = this.controls.get(id)
    const task = this.get(id)
    if (!control || !task || task.status !== 'paused') return
    control.paused = false
    this.update(resumeTask(task, Date.now()))
    for (const wake of control.waiters.splice(0)) wake()
  }

  cancel(id: string): void {
    const control = this.controls.get(id)
    const task = this.get(id)
    if (!control || !task || isTerminal(task.status)) return
    control.cancelled = true
    control.paused = false
    this.update(cancelTask(task, Date.now()))
    for (const wake of control.waiters.splice(0)) wake()
  }

  /** Re-run only the failed files of a finished task as a fresh batch. */
  retry(id: string): string | null {
    const task = this.get(id)
    const control = this.controls.get(id)
    if (!task || !control) return null
    const files = failedFiles(task)
    if (files.length === 0) return null
    return control.spawn(files)
  }

  /** Plain-text log for export. */
  logText(id: string): string | null {
    const task = this.get(id)
    if (!task) return null
    const head = [
      `Task: ${task.label ?? task.type}`,
      `Type: ${task.type}`,
      `Status: ${task.status}`,
      `Total: ${task.total}  Completed: ${task.completed}  Failed: ${task.failed}`,
      '',
    ]
    const lines = task.logs.map((l) => {
      const when = new Date(l.at).toISOString()
      const file = l.filePath ? ` ${l.filePath}` : ''
      return `[${when}] ${l.level.toUpperCase()}${file} — ${l.message}`
    })
    return [...head, ...lines].join('\n')
  }

  /** Remove finished (terminal) tasks and their control state. */
  clearFinished(): void {
    for (const [id, task] of this.tasks) {
      if (isTerminal(task.status)) {
        this.tasks.delete(id)
        this.controls.delete(id)
      }
    }
    this.emit()
  }
}

/** App-wide singleton scheduler. */
export const taskScheduler = new TaskScheduler()
