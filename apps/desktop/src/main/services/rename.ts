import { rename, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { isValidFilename } from '@folio/core'
import type { RenameExecRequest, RenameItemResult, RenameResult } from '@folio/shared-types'

// Batch-rename execution (PRD §6.8). The renderer computes + previews the plan via @folio/core's
// pure `planRename`; this service applies a validated, name-only op list within one directory.
//
// Cycle safety: a plan can contain A→B together with B→A (or any reordering), so renaming in place
// would clobber. We rename every source to a unique temp name first (phase 1), then temp→target
// (phase 2). On any failure we roll back completed steps so unprocessed files are never harmed and
// no data is lost (§6.8 「操作失败不得影响未处理文件」).

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

/** Defensive re-validation mirroring the core planner — refuse a plan that could lose data. */
function validate(ops: Array<{ from: string; to: string }>): string | null {
  const targetCount = new Map<string, number>()
  for (const o of ops) targetCount.set(o.to, (targetCount.get(o.to) ?? 0) + 1)
  for (const o of ops) {
    if (!isValidFilename(o.to)) return `Illegal target name: ${o.to}`
    if ((targetCount.get(o.to) ?? 0) > 1) return `Duplicate target name: ${o.to}`
    // A target may equal another source (cycle) — fine; the two-phase temp pass handles it. An
    // *external* collision (target exists and isn't part of the set) is caught at write time below.
  }
  return null
}

export async function renameInDirectory(request: RenameExecRequest): Promise<RenameResult> {
  const { directory } = request
  // Apply only ops that actually change the name.
  const ops = request.ops.filter((o) => o.from !== o.to)
  const results: RenameItemResult[] = []

  const invalid = validate(ops)
  if (invalid) {
    return {
      results: ops.map((o) => ({ from: o.from, to: o.to, status: 'failed', error: invalid })),
    }
  }

  const abs = (name: string): string => join(directory, name)
  const tempOf = (i: number): string => abs(`.folio-rename-${i}.tmp`)

  // Guard: a temp name must not already exist (extremely unlikely, but never clobber).
  for (let i = 0; i < ops.length; i++) {
    if (await exists(tempOf(i))) {
      return {
        results: ops.map((o) => ({
          from: o.from,
          to: o.to,
          status: 'failed',
          error: 'Temporary name conflict; aborted',
        })),
      }
    }
  }

  // Phase 1: source → unique temp. Track for rollback.
  const movedToTemp: Array<{ temp: string; from: string }> = []
  try {
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i] as { from: string; to: string }
      await rename(abs(op.from), tempOf(i))
      movedToTemp.push({ temp: tempOf(i), from: abs(op.from) })
    }
  } catch (e) {
    // Roll back any temps created so far, then report all as failed.
    for (const m of movedToTemp.reverse()) await rename(m.temp, m.from).catch(() => {})
    const error = e instanceof Error ? e.message : String(e)
    return { results: ops.map((o) => ({ from: o.from, to: o.to, status: 'failed', error })) }
  }

  // Phase 2: temp → final target. Track for rollback.
  const movedToFinal: Array<{ finalPath: string; temp: string }> = []
  try {
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i] as { from: string; to: string }
      const finalPath = abs(op.to)
      // An external file already at the target would be clobbered — refuse and roll back.
      if (await exists(finalPath)) throw new Error(`Target already exists: ${op.to}`)
      await rename(tempOf(i), finalPath)
      movedToFinal.push({ finalPath, temp: tempOf(i) })
      results.push({ from: op.from, to: op.to, status: 'success' })
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    // Roll back: finals back to their temp, then all temps back to original sources.
    for (const m of movedToFinal.reverse()) await rename(m.finalPath, m.temp).catch(() => {})
    for (const m of movedToTemp.reverse()) await rename(m.temp, m.from).catch(() => {})
    return { results: ops.map((o) => ({ from: o.from, to: o.to, status: 'failed', error })) }
  }

  return { results }
}
