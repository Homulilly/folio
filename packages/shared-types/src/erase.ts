// Exif erasure types (M4, PRD §6.5 / §11). Read-only viewing is M3 (see metadata.ts).
// Safety baseline (§13): never overwrite the original unless explicitly chosen; never delete the
// original on failure; verify removal afterwards.

/**
 * - `remove_selected`: strip the tags/patterns in `removeTags`, keep everything else.
 * - `remove_all_except_keep`: strip everything except the tags in `keepTags`.
 */
export type EraseMode = 'remove_selected' | 'remove_all_except_keep'

/** Built-in presets (PRD §6.5 常用预设) plus a user-defined `custom`. */
export type ErasePresetId = 'privacy' | 'share' | 'full' | 'copyright' | 'custom'

/**
 * The user's remembered erase configuration (persisted to settings.json, M7): last-used preset,
 * checked category keys, and extra tags. The erase dialog pre-fills from this so a chosen rule
 * survives restarts. `categories` are plain strings (validated against the renderer's category list)
 * to avoid coupling the settings contract to @folio/core's EraseCategory type.
 */
export interface DefaultEraseRule {
  preset: ErasePresetId
  categories: string[]
  customTags: string
}

/** A resolved erasure rule. Tag entries are ExifTool tag names/patterns without `-`/`=`. */
export interface EraseRule {
  mode: EraseMode
  /** Tags/patterns to remove (used when mode is `remove_selected`). */
  removeTags: string[]
  /** Tags to retain (used when mode is `remove_all_except_keep`). */
  keepTags: string[]
}

/**
 * Where the erased output goes.
 * - `export`: write a stripped copy to `targetPath`; the original is never touched (it is the
 *   backup). This is the safe default.
 * - `in_place`: overwrite the original with no backup — destructive. (A backup would just
 *   duplicate what `export` already gives you, so it isn't offered.)
 */
export type EraseTarget = { kind: 'export'; targetPath: string } | { kind: 'in_place' }

/**
 * A batch erase request (Phase C). The same `rule` is applied to every file; the scheduler
 * computes each output target itself:
 * - `export`: write a stripped copy beside each original (`exportSuffix`, default `-noexif`),
 *   auto-incrementing on conflict. Safe — originals are untouched.
 * - `in_place`: overwrite each original (destructive; the UI double-confirms, PRD §13.10).
 */
export interface BatchEraseRequest {
  filePaths: string[]
  rule: EraseRule
  output: 'export' | 'in_place'
  exportSuffix?: string
  /** Human-readable title for the batch page. */
  label?: string
}

/**
 * Auto-mode rule (PRD §6.6). The MVP wires only the `session_directory` scope (in-memory, cleared
 * on restart) with implicit export-new application; the persistent scopes
 * (`directory` / `directory_recursive` / `global`) and `applyOn` modes land with `settings.json` in
 * M7. This type documents the full target shape so the session store stays forward-compatible.
 */
export type ExifAutoScope = 'session_directory' | 'directory' | 'directory_recursive' | 'global'

export interface ExifAutoRule {
  id: string
  name: string
  enabled: boolean
  scope: ExifAutoScope
  directory?: string
  mode: EraseMode
  removeTags: string[]
  keepTags?: string[]
  applyOn: 'manual_confirm' | 'on_save' | 'on_export' | 'on_open'
  createdAt: number
  updatedAt: number
}

export type EraseStatus = 'success' | 'failed' | 'skipped'

/** Outcome of erasing one file. */
export interface EraseResult {
  filePath: string
  status: EraseStatus
  /** Resulting file (the export copy, or the original path for in-place). */
  outputPath?: string
  /** Patterns confirmed absent on re-read (post-erase verification, §6.5). */
  verifiedRemoved?: string[]
  /** Requested patterns still present after erase (verification warning). */
  stillPresent?: string[]
  error?: string
}
