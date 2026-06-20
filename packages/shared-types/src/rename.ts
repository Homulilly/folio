// Batch-rename types (M5, PRD §6.8). The pure planner (`@folio/core` `planRename`/`applyRename`)
// turns options into a preview/dry-run plan; the main process executes a validated op list with a
// cycle-safe two-phase rename. Safety baseline (§6.8): preview + conflict/illegal detection +
// A→B/B→A cycle safety + log + never harm unprocessed files.

/**
 * Mode 1 — replace/delete characters (PRD §6.8 模式一).
 * Delete is `replace` with an empty `replace` string.
 */
export interface ReplaceOptions {
  kind: 'replace'
  /** Search string, or a regular-expression source when `useRegex`. */
  find: string
  /** Replacement (empty string = delete). */
  replace: string
  useRegex: boolean
  caseSensitive: boolean
  /** When false, only the name (not the extension) is transformed. */
  includeExtension: boolean
}

/**
 * Mode 2 — delete by position (PRD §6.8 模式二):
 * - `range`: from 1-based position `start`, delete `count` chars.
 * - `first`: delete the first `count` chars.
 * - `last`: delete the last `count` chars.
 * - `before`: delete everything before the first occurrence of `marker` (marker kept).
 * - `after`: delete everything after the first occurrence of `marker` (marker kept).
 */
export interface DeleteOptions {
  kind: 'delete'
  op: 'range' | 'first' | 'last' | 'before' | 'after'
  start?: number
  count?: number
  marker?: string
  includeExtension: boolean
}

/**
 * Mode 3 — sequential numbering (PRD §6.8 模式三): `<prefix><separator><nr>`, e.g. `Nr:001`.
 * The number is the 1-based ordinal in the (already sorted) input order, offset by `start`.
 */
export interface SequenceOptions {
  kind: 'sequence'
  prefix: string
  separator: string
  /** Starting number (e.g. 1). */
  start: number
  /** Zero-padded width (e.g. 3 → `001`). */
  padding: number
  keepExtension: boolean
}

export type RenameOptions = ReplaceOptions | DeleteOptions | SequenceOptions

/** Why an op can't be applied safely — surfaced per-row in the preview and blocks execution. */
export type RenameIssue = 'illegal' | 'duplicate' | 'collision'

/** One planned rename. `changed` is false when `to === from` (a no-op, skipped on execute). */
export interface RenameOp {
  from: string
  to: string
  changed: boolean
  /**
   * Blocking problem with this op (if any). Note: a target that collides with another *renamed*
   * source (an A→B/B→A cycle) is NOT an issue — execution handles it via a two-phase rename.
   */
  issue?: RenameIssue
}

/** The full dry-run plan for the preview table. */
export interface RenamePlan {
  ops: RenameOp[]
  /** True if any op carries an `issue` — the UI must disable execution. */
  hasBlockingIssues: boolean
  counts: {
    changed: number
    unchanged: number
    illegal: number
    duplicate: number
    collision: number
  }
}

/** IPC payload: the validated, name-only ops to apply within one directory. */
export interface RenameExecRequest {
  directory: string
  ops: Array<{ from: string; to: string }>
}

export type RenameItemStatus = 'success' | 'failed'

export interface RenameItemResult {
  from: string
  to: string
  status: RenameItemStatus
  error?: string
}

export interface RenameResult {
  results: RenameItemResult[]
}
