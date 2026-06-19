import type { MultiViewMode } from '@folio/shared-types'

/** How many items advance per group step in each multi-view mode (PRD §6.2). */
export function viewCountForMode(mode: MultiViewMode): 1 | 2 | 3 | 4 {
  switch (mode) {
    case 'single':
      return 1
    case 'dual':
      return 2
    case 'triple':
      return 3
    case 'quad':
      return 4
  }
}

export interface GroupStepOptions {
  startIndex: number
  mode: MultiViewMode
  total: number
  /** When true, stepping past the ends wraps around (PRD "循环浏览"). */
  loop?: boolean
}

/**
 * Compute the next group's start index. Steps by the mode's view count, clamped to
 * a valid group start (or wrapped when loop is enabled). Returns the same index when
 * the queue is empty.
 */
export function nextGroupStart({
  startIndex,
  mode,
  total,
  loop = false,
}: GroupStepOptions): number {
  if (total <= 0) return 0
  const step = viewCountForMode(mode)
  const candidate = startIndex + step
  if (candidate < total) return candidate
  return loop ? 0 : startIndex
}

/** Compute the previous group's start index (mirror of {@link nextGroupStart}). */
export function previousGroupStart({
  startIndex,
  mode,
  total,
  loop = false,
}: GroupStepOptions): number {
  if (total <= 0) return 0
  const step = viewCountForMode(mode)
  const candidate = startIndex - step
  if (candidate >= 0) return candidate
  if (!loop) return startIndex
  // Wrap to the last aligned group: the largest multiple of step that is < total.
  return Math.floor((total - 1) / step) * step
}

/**
 * Align an arbitrary item index to the start of the group it belongs to. Groups are
 * aligned to the mode's step from 0 (e.g. quad → 0,4,8,…), so the focused image keeps its
 * slot when switching modes and the group recomputes after sort/delete.
 */
export function groupStartForIndex(index: number, mode: MultiViewMode): number {
  if (index <= 0) return 0
  const step = viewCountForMode(mode)
  return Math.floor(index / step) * step
}

/**
 * The items that fill the current group, padded with `null` for trailing blank slots when
 * the queue runs out (PRD: end-of-queue shows remaining images, blanks read "no more images").
 * Returns exactly `viewCountForMode(mode)` entries.
 */
export function groupSlots<T>(
  items: readonly T[],
  startIndex: number,
  mode: MultiViewMode,
): (T | null)[] {
  const step = viewCountForMode(mode)
  const slots: (T | null)[] = []
  for (let i = 0; i < step; i++) slots.push(items[startIndex + i] ?? null)
  return slots
}
