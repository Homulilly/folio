import type { MultiViewMode } from '@galleryviewer/shared-types'

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
