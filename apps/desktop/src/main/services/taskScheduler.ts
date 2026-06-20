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
import type { BatchEraseRequest, EraseRule, EraseTarget, Task } from '@folio/shared-types'
import { eraseMetadata } from './exiftool'
import { suggestExportPath } from './paths'

// Main-process Task Scheduler (PRD §9.3). Owns task execution and lifecycle; the pure transition
// rules / counters live in @folio/core. Batch erase runs files sequentially (ExifTool writes are
// the bottleneck and can't be interrupted mid-file), checking pause/cancel between files. Every
// state change pushes the full task list to the renderer via `emit`.

/** Per-task runtime control: pause/cancel flags + the inputs needed to retry failed files. */
interface Control {
  paused: boolean
  cancelled: boolean
  /** Resolvers for a runner currently parked in `waitIfPaused`. */
  waiters: Array<() => void>
  filePaths: string[]
  rule: EraseRule
  output: 'export' | 'in_place'
  exportSuffix: string
  label?: string
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

  /** Snapshot the live task or throw — internal callers always hold a valid id. */
  private get(id: string): Task | undefined {
    return this.tasks.get(id)
  }

  startEraseBatch(request: BatchEraseRequest): string {
    const id = randomUUID()
    const control: Control = {
      paused: false,
      cancelled: false,
      waiters: [],
      filePaths: request.filePaths,
      rule: request.rule,
      output: request.output,
      exportSuffix: request.exportSuffix ?? '-noexif',
      label: request.label,
    }
    this.controls.set(id, control)
    this.tasks.set(
      id,
      createTask({
        id,
        type: 'metadata_remove',
        total: request.filePaths.length,
        now: Date.now(),
        label: request.label,
      }),
    )
    this.emit()
    void this.run(id)
    return id
  }

  private async run(id: string): Promise<void> {
    const control = this.controls.get(id)
    const initial = this.get(id)
    if (!control || !initial) return
    this.update(startTask(initial, Date.now()))

    for (const filePath of control.filePaths) {
      if (control.cancelled) break
      await this.waitIfPaused(control)
      if (control.cancelled) break

      this.update(setCurrentFile(this.get(id) as Task, filePath, Date.now()))

      const { ok, message, warn } = await this.eraseOne(filePath, control)
      let task = recordResult(this.get(id) as Task, { ok, filePath, message, now: Date.now() })
      // A verify residual is a soft warning, not a failure — the write itself succeeded.
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

  /** Erase one file; map the result to a success flag + a log message. */
  private async eraseOne(
    filePath: string,
    control: Control,
  ): Promise<{ ok: boolean; message?: string; warn?: string }> {
    try {
      const target: EraseTarget =
        control.output === 'in_place'
          ? { kind: 'in_place' }
          : { kind: 'export', targetPath: await suggestExportPath(filePath, control.exportSuffix) }
      const res = await eraseMetadata(filePath, control.rule, target)
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
    return this.startEraseBatch({
      filePaths: files,
      rule: control.rule,
      output: control.output,
      exportSuffix: control.exportSuffix,
      label: control.label,
    })
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
