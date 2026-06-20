import type {
  DeleteOptions,
  RenameOp,
  RenameOptions,
  RenamePlan,
  ReplaceOptions,
  SequenceOptions,
} from '@folio/shared-types'
import { isValidFilename, padNumber } from './naming'

// Batch-rename planner (PRD §6.8). Pure logic only — the main process executes a validated op list
// with a cycle-safe two-phase rename. Operates on file *names* (basename incl. extension), never on
// the filesystem. The plan is both the live preview and the dry-run (§6.8 安全要求).

/** Split a file name into base + extension (incl. the dot, e.g. `.jpg`). Dotfiles have no ext. */
function splitExt(fileName: string): { base: string; ext: string } {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0) return { base: fileName, ext: '' }
  return { base: fileName.slice(0, dot), ext: fileName.slice(dot) }
}

/** Escape a literal string for use inside a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function applyReplace(fileName: string, o: ReplaceOptions): string {
  if (o.find === '') return fileName
  const target = o.includeExtension ? { base: fileName, ext: '' } : splitExt(fileName)
  const flags = o.caseSensitive ? 'g' : 'gi'
  let re: RegExp
  try {
    re = new RegExp(o.useRegex ? o.find : escapeRegExp(o.find), flags)
  } catch {
    // Invalid user regex → no-op (the preview shows the name unchanged rather than throwing).
    return fileName
  }
  return target.base.replace(re, o.replace) + target.ext
}

function applyDelete(fileName: string, o: DeleteOptions): string {
  const target = o.includeExtension ? { base: fileName, ext: '' } : splitExt(fileName)
  const s = target.base
  let base = s
  switch (o.op) {
    case 'range': {
      // 1-based start, delete `count` chars.
      const start = Math.max(1, o.start ?? 1) - 1
      const count = Math.max(0, o.count ?? 0)
      base = s.slice(0, start) + s.slice(start + count)
      break
    }
    case 'first':
      base = s.slice(Math.max(0, o.count ?? 0))
      break
    case 'last': {
      const count = Math.max(0, o.count ?? 0)
      base = count >= s.length ? '' : s.slice(0, s.length - count)
      break
    }
    case 'before': {
      // Delete everything before the first occurrence of marker (marker kept).
      if (!o.marker) break
      const idx = s.indexOf(o.marker)
      base = idx >= 0 ? s.slice(idx) : s
      break
    }
    case 'after': {
      // Delete everything after the first occurrence of marker (marker kept).
      if (!o.marker) break
      const idx = s.indexOf(o.marker)
      base = idx >= 0 ? s.slice(0, idx + o.marker.length) : s
      break
    }
  }
  return base + target.ext
}

function applySequence(fileName: string, o: SequenceOptions, ordinal: number): string {
  const { ext } = splitExt(fileName)
  const number = padNumber(o.start + ordinal, o.padding)
  const base = `${o.prefix}${o.separator}${number}`
  return o.keepExtension ? base + ext : base
}

/**
 * Compute the new name for one file. `ordinal` is the 0-based position in the (sorted) input,
 * used only by sequence numbering.
 */
export function applyRename(fileName: string, options: RenameOptions, ordinal: number): string {
  switch (options.kind) {
    case 'replace':
      return applyReplace(fileName, options)
    case 'delete':
      return applyDelete(fileName, options)
    case 'sequence':
      return applySequence(fileName, options, ordinal)
  }
}

/**
 * Build a rename plan for the preview table / dry-run.
 *
 * Issue rules (each blocks execution):
 * - `illegal`   — the target is empty or contains illegal filename characters.
 * - `duplicate` — two ops map to the same target name.
 * - `collision` — the target matches an existing file in the directory that is NOT itself being
 *                 renamed (so applying it would clobber an unrelated file).
 *
 * A target that equals another op's *source* (an A→B/B→A cycle, or any reorder) is intentionally
 * NOT flagged — the executor resolves these with a two-phase rename through temp names.
 *
 * @param fileNames    the directory's file names, in display order (drives sequence numbering).
 * @param existingNames all names currently in the directory (defaults to `fileNames`). Used to spot
 *                       collisions with files outside the rename set.
 */
export function planRename(
  fileNames: string[],
  options: RenameOptions,
  existingNames: string[] = fileNames,
): RenamePlan {
  const ops: RenameOp[] = fileNames.map((from, i) => {
    const to = applyRename(from, options, i)
    return { from, to, changed: to !== from }
  })

  const sources = new Set(fileNames)
  // Count how many ops target each name, to detect duplicates among changed ops.
  const targetCounts = new Map<string, number>()
  for (const op of ops) if (op.changed) targetCounts.set(op.to, (targetCounts.get(op.to) ?? 0) + 1)

  const counts = { changed: 0, unchanged: 0, illegal: 0, duplicate: 0, collision: 0 }

  for (const op of ops) {
    if (!op.changed) {
      counts.unchanged++
      continue
    }
    counts.changed++
    if (!isValidFilename(op.to)) {
      op.issue = 'illegal'
      counts.illegal++
    } else if ((targetCounts.get(op.to) ?? 0) > 1) {
      op.issue = 'duplicate'
      counts.duplicate++
    } else if (existingNames.includes(op.to) && !sources.has(op.to)) {
      // Target exists already and isn't part of the rename set → would overwrite an unrelated file.
      op.issue = 'collision'
      counts.collision++
    }
  }

  return {
    ops,
    hasBlockingIssues: counts.illegal + counts.duplicate + counts.collision > 0,
    counts,
  }
}
