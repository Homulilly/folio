import type { Task } from '@folio/shared-types'
import { getDb } from './db'

// Persist finished batch tasks to SQLite so the batch page still lists them after a restart (M7).
// Only the serialisable Task is stored — the runtime Control (execute/spawn closures) can't be
// persisted, so a loaded task is marked `restored` and can be viewed/exported but not retried.

const HISTORY_LIMIT = 200

let ready = false
function ensure(): import('better-sqlite3').Database {
  const db = getDb()
  if (ready) return db
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_history (
      id         TEXT PRIMARY KEY,
      created_ms INTEGER NOT NULL,
      json       TEXT NOT NULL
    );
  `)
  ready = true
  return db
}

/** Upsert a (terminal) task into history, trimming to the newest HISTORY_LIMIT rows. */
export function persistTask(task: Task): void {
  const db = ensure()
  db.prepare('INSERT OR REPLACE INTO task_history (id, created_ms, json) VALUES (?, ?, ?)').run(
    task.id,
    task.createdAt,
    JSON.stringify(task),
  )
  db.prepare(
    'DELETE FROM task_history WHERE id IN (SELECT id FROM task_history ORDER BY created_ms DESC LIMIT -1 OFFSET ?)',
  ).run(HISTORY_LIMIT)
}

export function removeHistory(id: string): void {
  ensure().prepare('DELETE FROM task_history WHERE id = ?').run(id)
}

/** Load persisted tasks (newest first), each flagged `restored`. */
export function loadHistory(): Task[] {
  const rows = ensure()
    .prepare('SELECT json FROM task_history ORDER BY created_ms DESC')
    .all() as Array<{ json: string }>
  const tasks: Task[] = []
  for (const row of rows) {
    try {
      tasks.push({ ...(JSON.parse(row.json) as Task), restored: true })
    } catch {
      // Skip a corrupt row rather than failing the whole load.
    }
  }
  return tasks
}
