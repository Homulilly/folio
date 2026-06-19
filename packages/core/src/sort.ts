import type { ImageQueueItem, SortMode } from '@folio/shared-types'

/** Natural-ish, case-insensitive filename comparison (so img2 < img10). */
function compareName(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

type Comparator = (a: ImageQueueItem, b: ImageQueueItem) => number

const COMPARATORS: Record<SortMode, Comparator> = {
  name_asc: (a, b) => compareName(a.fileName, b.fileName),
  name_desc: (a, b) => compareName(b.fileName, a.fileName),
  modified_asc: (a, b) => a.modifiedAt - b.modifiedAt,
  modified_desc: (a, b) => b.modifiedAt - a.modifiedAt,
  created_asc: (a, b) => (a.createdAt ?? a.modifiedAt) - (b.createdAt ?? b.modifiedAt),
  created_desc: (a, b) => (b.createdAt ?? b.modifiedAt) - (a.createdAt ?? a.modifiedAt),
  size_asc: (a, b) => a.size - b.size,
  size_desc: (a, b) => b.size - a.size,
  format_asc: (a, b) => compareName(a.ext, b.ext) || compareName(a.fileName, b.fileName),
}

/**
 * Return a new array sorted by the given mode. Ties fall back to name order so the
 * result is stable and deterministic regardless of input order.
 */
export function sortItems(items: readonly ImageQueueItem[], mode: SortMode): ImageQueueItem[] {
  const cmp = COMPARATORS[mode]
  return [...items].sort((a, b) => cmp(a, b) || compareName(a.fileName, b.fileName))
}

export const SORT_MODES: readonly SortMode[] = [
  'name_asc',
  'name_desc',
  'modified_asc',
  'modified_desc',
  'created_asc',
  'created_desc',
  'size_asc',
  'size_desc',
  'format_asc',
]

export const SORT_MODE_LABELS: Record<SortMode, string> = {
  name_asc: 'Name (A–Z)',
  name_desc: 'Name (Z–A)',
  modified_asc: 'Modified (oldest)',
  modified_desc: 'Modified (newest)',
  created_asc: 'Created (oldest)',
  created_desc: 'Created (newest)',
  size_asc: 'Size (smallest)',
  size_desc: 'Size (largest)',
  format_asc: 'Format',
}
