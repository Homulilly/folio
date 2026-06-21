import type { ExifEntry, ExifGroup, ExifIfd1Fallback, ExifMetadata } from '@folio/shared-types'

// ---- Raw tag normalisation -------------------------------------------------
//
// The main process reads tags with ExifTool's family-0 grouping (`-G0`), producing a flat
// record whose keys look like `EXIF:Make`, `GPS:GPSLatitude`, `Composite:ImageSize`. These pure
// helpers turn that into ordered, display-ready groups — kept out of the main process so they
// can be unit-tested without spawning ExifTool.

/** ExifTool envelope fields that aren't real metadata. */
const IGNORED_KEYS = new Set(['SourceFile', 'errors', 'warnings', 'Error', 'Warning'])

/** Preferred display order for family-0 groups; groups not listed follow, alphabetically. */
const GROUP_ORDER = [
  'File',
  'EXIF',
  'Composite',
  'GPS',
  'XMP',
  'IPTC',
  'ICC_Profile',
  'MakerNotes',
  'JFIF',
  'Photoshop',
  'PNG',
  'QuickTime',
]

/** Render a raw tag value (string | number | array | nested struct) to a single display string. */
export function stringifyExifValue(value: unknown): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(stringifyExifValue).filter(Boolean).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** Group `-G0` raw tags into ordered {group, entries}, dropping envelope/empty fields. */
export function buildExifGroups(raw: Record<string, unknown>): ExifGroup[] {
  const byGroup = new Map<string, ExifEntry[]>()
  for (const [rawKey, value] of Object.entries(raw)) {
    if (IGNORED_KEYS.has(rawKey)) continue
    const sep = rawKey.indexOf(':')
    const group = sep > 0 ? rawKey.slice(0, sep) : 'File'
    const key = sep > 0 ? rawKey.slice(sep + 1) : rawKey
    const str = stringifyExifValue(value)
    if (str === '') continue
    const list = byGroup.get(group)
    if (list) list.push({ key, value: str })
    else byGroup.set(group, [{ key, value: str }])
  }
  const rank = (g: string): number => {
    const i = GROUP_ORDER.indexOf(g)
    return i === -1 ? GROUP_ORDER.length : i
  }
  return [...byGroup.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([group, entries]) => ({ group, entries }))
}

// ---- Summary view ----------------------------------------------------------

export type ExifSummaryId =
  | 'dimensions'
  | 'camera'
  | 'lens'
  | 'dateTime'
  | 'iso'
  | 'shutter'
  | 'aperture'
  | 'focalLength'
  | 'gps'
  | 'description'
  | 'artist'
  | 'copyright'
  | 'comment'
  | 'uniqueId'

export interface ExifSummaryRow {
  id: ExifSummaryId
  value: string
}

/** Display order of summary rows. */
const SUMMARY_ORDER: ExifSummaryId[] = [
  'dimensions',
  'camera',
  'lens',
  'dateTime',
  'iso',
  'shutter',
  'aperture',
  'focalLength',
  'gps',
  'description',
  'artist',
  'copyright',
  'comment',
  'uniqueId',
]

/** Candidate field names (group-stripped) for each summary row, in priority order. */
const SUMMARY_FIELDS: Record<Exclude<ExifSummaryId, 'camera'>, string[]> = {
  dimensions: ['ImageSize'],
  lens: ['LensModel', 'LensID', 'LensType', 'Lens'],
  dateTime: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'],
  iso: ['ISO'],
  shutter: ['ShutterSpeed', 'ExposureTime'],
  aperture: ['Aperture', 'FNumber'],
  focalLength: ['FocalLength'],
  gps: ['GPSPosition', 'GPSCoordinates'],
  description: ['ImageDescription', 'Description', 'Caption-Abstract'],
  artist: ['Artist', 'Creator', 'By-line'],
  copyright: ['Copyright', 'Rights', 'CopyrightNotice'],
  comment: ['UserComment', 'XPComment', 'Comment'],
  uniqueId: ['ImageUniqueID', 'OriginalDocumentID', 'DocumentID'],
}

/** Flatten groups to a field→value lookup; first occurrence (in display order) wins. */
function flatten(groups: ExifGroup[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const g of groups) for (const e of g.entries) if (!map.has(e.key)) map.set(e.key, e.value)
  return map
}

/** Camera string from Make + Model, avoiding the common "Make duplicated in Model" case. */
function cameraLabel(make: string | undefined, model: string | undefined): string | undefined {
  if (make && model)
    return model.toLowerCase().startsWith(make.toLowerCase()) ? model : `${make} ${model}`
  return model ?? make
}

/**
 * Pick the common headline fields for the summary view. Omits rows with no data. `ifd1` supplies
 * IFD1 fallbacks for description / artist / copyright (tags 0x010E / 0x013B / 0x8298), used only
 * when the primary IFD0 value is empty.
 */
export function summarizeExif(groups: ExifGroup[], ifd1?: ExifIfd1Fallback): ExifSummaryRow[] {
  const lookup = flatten(groups)
  const pick = (names: string[]): string | undefined => {
    for (const n of names) {
      const v = lookup.get(n)
      if (v) return v
    }
    return undefined
  }
  const values: Partial<Record<ExifSummaryId, string | undefined>> = {
    camera: cameraLabel(lookup.get('Make'), lookup.get('Model')),
    dimensions: pick(SUMMARY_FIELDS.dimensions),
    lens: pick(SUMMARY_FIELDS.lens),
    dateTime: pick(SUMMARY_FIELDS.dateTime),
    iso: pick(SUMMARY_FIELDS.iso),
    shutter: pick(SUMMARY_FIELDS.shutter),
    aperture: pick(SUMMARY_FIELDS.aperture),
    focalLength: pick(SUMMARY_FIELDS.focalLength),
    gps: pick(SUMMARY_FIELDS.gps),
    description: pick(SUMMARY_FIELDS.description) ?? ifd1?.description,
    artist: pick(SUMMARY_FIELDS.artist) ?? ifd1?.artist,
    copyright: pick(SUMMARY_FIELDS.copyright) ?? ifd1?.copyright,
    comment: pick(SUMMARY_FIELDS.comment),
    uniqueId: pick(SUMMARY_FIELDS.uniqueId),
  }
  const rows: ExifSummaryRow[] = []
  for (const id of SUMMARY_ORDER) {
    const value = values[id]
    if (value) rows.push({ id, value })
  }
  return rows
}

// ---- Search & export -------------------------------------------------------

/** Filter groups by a query matched against group name, field name, or value (case-insensitive). */
export function filterExifGroups(groups: ExifGroup[], query: string): ExifGroup[] {
  const q = query.trim().toLowerCase()
  if (!q) return groups
  const result: ExifGroup[] = []
  for (const g of groups) {
    if (g.group.toLowerCase().includes(q)) {
      result.push(g)
      continue
    }
    const entries = g.entries.filter(
      (e) => e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q),
    )
    if (entries.length) result.push({ group: g.group, entries })
  }
  return result
}

/** Serialise metadata to a `{ group: { key: value } }` JSON string for "copy all". */
export function exifToJsonString(meta: ExifMetadata): string {
  const out: Record<string, Record<string, string>> = {}
  for (const g of meta.groups) {
    const fields: Record<string, string> = {}
    for (const e of g.entries) fields[e.key] = e.value
    out[g.group] = fields
  }
  return JSON.stringify(out, null, 2)
}
