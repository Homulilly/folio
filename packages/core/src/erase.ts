import type { ErasePresetId, EraseRule, ExifGroup } from '@folio/shared-types'

// Erasure rule model (PRD §6.5 / §11). Pure logic only — the main process turns these rules into
// ExifTool arguments and performs the write. Tag entries are ExifTool tag names/patterns *without*
// a leading `-` or trailing `=` (e.g. `GPS:all`, `*Serial*`, `DateTimeOriginal`).

/**
 * Privacy-sensitive tag groups (PRD §11.1/§11.2). Categories compose into presets and into the
 * erase dialog's per-category checkboxes. Patterns use ExifTool syntax (`GPS:all`, `*Serial*`).
 */
export const ERASE_CATEGORIES = {
  gps: ['GPS:all'],
  device: ['Make', 'Model', '*SerialNumber*', '*Serial*', 'CameraID', 'InternalSerialNumber'],
  uniqueid: ['ImageUniqueID'],
  datetime: ['DateTimeOriginal', 'CreateDate', 'ModifyDate', 'AllDates'],
  software: ['Software', 'ProcessingSoftware', 'HostComputer', 'CreatorTool'],
  thumbnail: ['ThumbnailImage', 'PreviewImage', 'JpgFromRaw', 'OtherImage'],
  description: [
    'ImageDescription',
    'Description',
    'Caption-Abstract',
    'UserComment',
    'XPComment',
    'XPSubject',
    'XPTitle',
    'Headline',
  ],
  identity: ['OwnerName', 'Artist', 'Copyright', 'Creator', 'Rights'],
} as const

export type EraseCategory = keyof typeof ERASE_CATEGORIES

/** Display order of category checkboxes in the erase dialog. */
export const ERASE_CATEGORY_ORDER: EraseCategory[] = [
  'gps',
  'device',
  'uniqueid',
  'datetime',
  'software',
  'thumbnail',
  'description',
  'identity',
]

/**
 * Which categories the category-based presets pre-select. Single source of truth shared by
 * `presetRule` (core) and the dialog's checkbox state (renderer), so they can't drift. share/full
 * are keep-mode presets and aren't represented here.
 */
export const CATEGORY_PRESETS: Partial<Record<ErasePresetId, EraseCategory[]>> = {
  privacy: ['gps', 'device', 'uniqueid', 'datetime', 'software', 'thumbnail', 'description'],
  copyright: ['gps', 'device', 'uniqueid'],
  custom: [],
}

/** Tags every preset keeps — display-intrinsic and non-identifying (PRD §11.2 保留). */
const KEEP_BASELINE = ['Orientation', 'ColorSpace', 'ICC_Profile', 'ImageWidth', 'ImageHeight']

/**
 * Family-0 groups ExifTool can never strip, so they must never be shown as "will be removed" in
 * the preview nor counted as leftovers in post-erase verification:
 * - `File`: filesystem facts (FileName/FileSize/dates/permissions) + values read from the JPEG
 *   structure (EncodingProcess, BitsPerSample, ColorComponents, ImageWidth/Height, Adobe APP14…).
 * - `Composite`: values ExifTool derives on read (ImageSize, Megapixels).
 * - `ExifTool`: ExifTool's own version.
 * Without this, a keep-only erase (share/full) "fails" verification because these always remain.
 */
const NON_REMOVABLE_GROUPS = new Set(['file', 'composite', 'exiftool'])

/** Whether a family-0 group holds tags ExifTool can actually remove. */
export function isRemovableGroup(group: string): boolean {
  return !NON_REMOVABLE_GROUPS.has(group.toLowerCase())
}

const uniq = (xs: string[]): string[] => [...new Set(xs)]

/** Flatten a set of categories into a de-duplicated remove list. */
export function tagsForCategories(categories: readonly EraseCategory[]): string[] {
  return uniq(categories.flatMap((c) => [...ERASE_CATEGORIES[c]]))
}

/** Resolve a built-in preset to a concrete rule (`custom` resolves to an empty remove list). */
export function presetRule(preset: ErasePresetId): EraseRule {
  switch (preset) {
    case 'share':
      // Keep only orientation + colour profile; strip everything else.
      return { mode: 'remove_all_except_keep', removeTags: [], keepTags: [...KEEP_BASELINE] }
    case 'full':
      // Strip every removable tag.
      return { mode: 'remove_all_except_keep', removeTags: [], keepTags: [] }
    case 'copyright':
      // Remove GPS + device, but keep copyright/author/ICC (so don't strip identity wholesale).
      return {
        mode: 'remove_selected',
        removeTags: tagsForCategories(CATEGORY_PRESETS.copyright ?? []),
        keepTags: ['Copyright', 'Artist', 'Creator', 'Rights', 'ICC_Profile'],
      }
    default:
      // privacy / custom — remove the preset's categories (custom starts empty).
      return {
        mode: 'remove_selected',
        removeTags: tagsForCategories(CATEGORY_PRESETS[preset] ?? []),
        keepTags: [],
      }
  }
}

// Tag patterns become `-pattern=` args, passed to ExifTool as discrete array elements (never a
// shell string), so they can't inject extra arguments. We still validate to reject obvious junk
// and keep error messages clean. Valid: letters, digits, `_`, `:`, `*`, and internal `-` (IPTC
// tags like `Caption-Abstract`). A leading `-` is disallowed so a tag can't look like a flag.
const TAG_PATTERN = /^[A-Za-z0-9_:*][A-Za-z0-9_:*-]*$/

export function isValidTagPattern(tag: string): boolean {
  return TAG_PATTERN.test(tag)
}

/** Parse a free-text tag list (comma/whitespace-separated) into valid and invalid patterns. */
export function parseTagList(input: string): { valid: string[]; invalid: string[] } {
  const tokens = input
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
  const valid: string[] = []
  const invalid: string[] = []
  for (const tok of tokens) (isValidTagPattern(tok) ? valid : invalid).push(tok)
  return { valid: [...new Set(valid)], invalid }
}

/** Split a rule's tags into valid/invalid; the caller refuses to run if anything is invalid. */
export function validateRule(rule: EraseRule): { valid: boolean; invalid: string[] } {
  const invalid = [...rule.removeTags, ...rule.keepTags].filter((t) => !isValidTagPattern(t))
  return { valid: invalid.length === 0, invalid }
}

/**
 * ExifTool write args for `remove_selected` mode: one `-<tag>=` per pattern. The caller appends
 * `-overwrite_original`. The `remove_all_except_keep` mode uses `deleteAllTags({ retain })`.
 *
 * EXIF tags (ImageDescription, Artist, Copyright, Make, …) are commonly duplicated in IFD1, the
 * thumbnail IFD; a bare `-Tag=` only clears the IFD0 copy and leaves the IFD1 one behind. So for
 * each *concrete* tag we also emit `-IFD1:Tag=`. Prefixing IFD1 onto a tag that doesn't live
 * there is a harmless no-op (verified), so no whitelist is needed; wildcard/`group:all` patterns
 * are skipped since they target groups, not IFD1 fields.
 */
export function buildRemoveArgs(rule: EraseRule): string[] {
  if (rule.mode !== 'remove_selected') return []
  const base = rule.removeTags.map((t) => `-${t}=`)
  const ifd1 = rule.removeTags
    .filter((t) => !t.includes('*') && !t.includes(':'))
    .map((t) => `-IFD1:${t}=`)
  return [...base, ...ifd1]
}

// ---- Erase preview (PRD §6.5 擦除前预览差异) ----

/** Does an ExifTool pattern match a present field? Handles `Group:all`, `*wild*`, and exact. */
export function matchesTagPattern(group: string, key: string, pattern: string): boolean {
  const p = pattern.toLowerCase()
  if (p.endsWith(':all')) return group.toLowerCase() === p.slice(0, -4)
  if (p.includes('*')) {
    const re = new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`)
    return re.test(key.toLowerCase())
  }
  return key.toLowerCase() === p
}

export interface EraseField {
  group: string
  key: string
}

/** Classify currently-present fields into those a rule removes vs. keeps — for the diff preview. */
export function partitionExifByRule(
  groups: ExifGroup[],
  rule: EraseRule,
): { removed: EraseField[]; keptCount: number } {
  const removed: EraseField[] = []
  let keptCount = 0
  const keepBaseline = KEEP_BASELINE.map((t) => t.toLowerCase())
  for (const g of groups) {
    // Filesystem/derived/ExifTool groups can't be stripped — they always remain, so count them
    // as kept and never show them as removable.
    if (!isRemovableGroup(g.group)) {
      keptCount += g.entries.length
      continue
    }
    for (const e of g.entries) {
      let isRemoved: boolean
      if (rule.mode === 'remove_selected') {
        isRemoved = rule.removeTags.some((p) => matchesTagPattern(g.group, e.key, p))
      } else {
        const keep =
          rule.keepTags.some((p) => matchesTagPattern(g.group, e.key, p)) ||
          keepBaseline.includes(e.key.toLowerCase())
        isRemoved = !keep
      }
      if (isRemoved) removed.push({ group: g.group, key: e.key })
      else keptCount++
    }
  }
  return { removed, keptCount }
}

// ---- Post-erase verification (PRD §6.5 擦除后验证字段已移除) ----

/** Concrete (non-wildcard) tag names from a remove list — the ones we can verify by exact key. */
function concreteTags(removeTags: string[]): string[] {
  return removeTags.filter((t) => !t.includes('*') && !t.endsWith(':all'))
}

/** All field keys present in the metadata, lower-cased, for membership checks. */
function presentKeys(groups: ExifGroup[]): Set<string> {
  const keys = new Set<string>()
  for (const g of groups) for (const e of g.entries) keys.add(e.key.toLowerCase())
  return keys
}

/**
 * Compare a rule's intended removals against re-read metadata. Returns which concrete tags are
 * confirmed gone vs. still present. Wildcards/`:all` groups are best-effort (skipped here).
 */
export function verifyRemoval(
  rule: EraseRule,
  groupsAfter: ExifGroup[],
): { verifiedRemoved: string[]; stillPresent: string[] } {
  if (rule.mode !== 'remove_selected') {
    // Keep-only mode: any *removable* tag outside keepTags + baseline should be gone. Filesystem /
    // derived / ExifTool groups always remain and must not be reported as leftovers.
    const keep = new Set(rule.keepTags.map((t) => t.toLowerCase()))
    const baseline = KEEP_BASELINE.map((t) => t.toLowerCase())
    const stillPresent: string[] = []
    for (const g of groupsAfter) {
      if (!isRemovableGroup(g.group)) continue
      for (const e of g.entries) {
        const k = e.key.toLowerCase()
        if (!keep.has(k) && !baseline.includes(k)) stillPresent.push(k)
      }
    }
    return { verifiedRemoved: [], stillPresent }
  }
  const present = presentKeys(groupsAfter)
  const verifiedRemoved: string[] = []
  const stillPresent: string[] = []
  for (const tag of concreteTags(rule.removeTags)) {
    if (present.has(tag.toLowerCase())) stillPresent.push(tag)
    else verifiedRemoved.push(tag)
  }
  return { verifiedRemoved, stillPresent }
}
