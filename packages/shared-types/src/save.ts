// Save-to-target types (M5, PRD §6.7). Saving copies an image into a chosen target folder under a
// computed name — it never moves or modifies the original (the original is always the backup, §13).

/**
 * How the saved copy is named:
 * - `keep`: keep the original file name.
 * - `md5` / `sha1`: `<hash>.<ext>` (the file's content hash + original extension).
 * - `template`: a naming template resolved by `@folio/core` `formatName` (e.g. `{date}_{nr:001}.{ext}`).
 *   The sequence preset (`{nr:001}`) is just a template.
 */
export interface NamingOptions {
  kind: 'keep' | 'md5' | 'sha1' | 'template'
  /** Naming template (used when kind is `template`). */
  template?: string
}

/**
 * What to do when a file of the resolved name already exists in the target folder. None of these
 * touch the original — they only decide the fate of the *copy*:
 * - `skip`: leave the existing target, report the file as skipped.
 * - `overwrite`: replace the existing target.
 * - `number`: write to `<base>-2<ext>`, `-3`, … (never clobbers).
 * - `md5_compare`: if the existing target has the same content hash, skip; otherwise fall back to
 *   `number` (PRD §6.7 「对比 MD5，相同则跳过」). The interactive per-file `ask` policy is deferred.
 */
export type ConflictPolicy = 'skip' | 'overwrite' | 'number' | 'md5_compare'

/** One image to save, with the index/size context the naming template may reference. */
export interface SaveFileInput {
  filePath: string
  /** 1-based position in the queue (drives `{index}`). */
  index: number
  width?: number
  height?: number
}

/**
 * A save request. A single focused image uses `file.saveToTarget` (direct, returns results); a
 * group/folder uses `task.startSaveBatch` (scheduler + batch page, so the group preview / progress
 * requirement in §6.7 is met). The same `naming`/`conflict` apply to every file.
 */
export interface SaveRequest {
  files: SaveFileInput[]
  targetDir: string
  naming: NamingOptions
  conflict: ConflictPolicy
  /** Human-readable title for the batch page. */
  label?: string
}

export type SaveStatus = 'success' | 'skipped' | 'failed'

/** Outcome of saving one file. */
export interface SaveResult {
  filePath: string
  status: SaveStatus
  /** The written copy's path (absent when skipped/failed). */
  outputPath?: string
  error?: string
}
