import { describe, expect, it } from 'vitest'
import {
  appendLog,
  canCancel,
  cancelTask,
  canPause,
  canResume,
  canRetry,
  canTransition,
  createTask,
  errorLogs,
  failedFiles,
  finalizeTask,
  isTerminal,
  pauseTask,
  recordResult,
  resumeTask,
  setCurrentFile,
  setStatus,
  startTask,
  taskProgress,
} from './task'

const newTask = (total = 3) =>
  createTask({ id: 't1', type: 'metadata_remove', total, now: 100, label: 'Erase' })

describe('createTask', () => {
  it('starts pending with zeroed counters and the given label', () => {
    const t = newTask()
    expect(t).toMatchObject({
      id: 't1',
      type: 'metadata_remove',
      status: 'pending',
      total: 3,
      completed: 0,
      failed: 0,
      createdAt: 100,
      updatedAt: 100,
      logs: [],
      label: 'Erase',
    })
  })

  it('omits label when not provided', () => {
    expect('label' in createTask({ id: 'x', type: 'hash', total: 1, now: 0 })).toBe(false)
  })
})

describe('transition table', () => {
  it('permits the batch lifecycle and forbids resurrecting terminal tasks', () => {
    expect(canTransition('pending', 'running')).toBe(true)
    expect(canTransition('running', 'paused')).toBe(true)
    expect(canTransition('paused', 'running')).toBe(true)
    expect(canTransition('running', 'success')).toBe(true)
    expect(canTransition('success', 'running')).toBe(false)
    expect(canTransition('pending', 'paused')).toBe(false)
    expect(isTerminal('cancelled')).toBe(true)
    expect(isTerminal('running')).toBe(false)
  })

  it('setStatus throws on an illegal move and is a no-op (but touches) for same-status', () => {
    const t = startTask(newTask(), 200)
    expect(() => setStatus(t, 'pending', 300)).toThrow(/Illegal task transition/)
    expect(setStatus(t, 'running', 300).updatedAt).toBe(300)
  })
})

describe('recordResult', () => {
  it('bumps completed/failed and appends a matching log', () => {
    let t = startTask(newTask(2), 200)
    t = recordResult(t, { ok: true, filePath: '/a.jpg', now: 210 })
    t = recordResult(t, { ok: false, filePath: '/b.jpg', message: 'boom', now: 220 })
    expect(t.completed).toBe(1)
    expect(t.failed).toBe(1)
    expect(t.logs).toEqual([
      { at: 210, level: 'info', message: 'done', filePath: '/a.jpg' },
      { at: 220, level: 'error', message: 'boom', filePath: '/b.jpg' },
    ])
    expect(t.updatedAt).toBe(220)
  })
})

describe('pause / resume / cancel', () => {
  it('pauses and resumes a running task', () => {
    let t = startTask(newTask(), 200)
    t = pauseTask(t, 210)
    expect(t.status).toBe('paused')
    t = resumeTask(t, 220)
    expect(t.status).toBe('running')
  })

  it('cancel clears the current-file marker', () => {
    let t = setCurrentFile(startTask(newTask(), 200), '/a.jpg', 205)
    expect(t.currentFile).toBe('/a.jpg')
    t = cancelTask(t, 210)
    expect(t.status).toBe('cancelled')
    expect(t.currentFile).toBeUndefined()
  })
})

describe('finalizeTask', () => {
  it('is success when at least one item succeeded', () => {
    let t = startTask(newTask(2), 200)
    t = recordResult(t, { ok: true, filePath: '/a.jpg', now: 210 })
    t = recordResult(t, { ok: false, filePath: '/b.jpg', now: 220 })
    expect(finalizeTask(t, 230).status).toBe('success')
  })

  it('is failed only when every item failed', () => {
    let t = startTask(newTask(2), 200)
    t = recordResult(t, { ok: false, filePath: '/a.jpg', now: 210 })
    t = recordResult(t, { ok: false, filePath: '/b.jpg', now: 220 })
    expect(finalizeTask(t, 230).status).toBe('failed')
  })
})

describe('derived views', () => {
  it('taskProgress is processed/total, clamped, and 1 for empty tasks', () => {
    let t = startTask(newTask(4), 200)
    t = recordResult(t, { ok: true, filePath: '/a.jpg', now: 210 })
    t = recordResult(t, { ok: false, filePath: '/b.jpg', now: 220 })
    expect(taskProgress(t)).toBe(0.5)
    expect(taskProgress(createTask({ id: 'e', type: 'hash', total: 0, now: 0 }))).toBe(1)
  })

  it('errorLogs and failedFiles surface only failures, deduped', () => {
    let t = startTask(newTask(3), 200)
    t = recordResult(t, { ok: true, filePath: '/a.jpg', now: 210 })
    t = recordResult(t, { ok: false, filePath: '/b.jpg', now: 220 })
    t = appendLog(t, { at: 225, level: 'error', message: 'retry failed', filePath: '/b.jpg' })
    expect(errorLogs(t)).toHaveLength(2)
    expect(failedFiles(t)).toEqual(['/b.jpg'])
  })
})

describe('capability guards', () => {
  it('reflect the current status', () => {
    const running = startTask(newTask(), 200)
    expect([canPause(running), canResume(running), canCancel(running)]).toEqual([true, false, true])

    const paused = pauseTask(running, 210)
    expect([canPause(paused), canResume(paused), canCancel(paused)]).toEqual([false, true, true])

    let failed = startTask(newTask(1), 200)
    failed = finalizeTask(recordResult(failed, { ok: false, filePath: '/a.jpg', now: 210 }), 220)
    expect([canCancel(failed), canRetry(failed)]).toEqual([false, true])
  })
})
