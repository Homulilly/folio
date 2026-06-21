import type { ExifSummaryId } from '@folio/core'
import type { I18nKey } from '../i18n'

// Exif group accent colors — from the design system (CLAUDE.md / .dev/design): EXIF blue,
// GPS red, XMP/IPTC green, File/MakerNotes neutral. Composite shares EXIF's blue (derived
// shooting params), ICC the green family. Unknown groups fall back to neutral.
const GROUP_COLORS: Record<string, string> = {
  EXIF: '#0A84FF',
  Composite: '#0A84FF',
  GPS: '#FF453A',
  XMP: '#32D7A0',
  IPTC: '#32D7A0',
  ICC_Profile: '#32D7A0',
  File: '#8E8E93',
  MakerNotes: '#8E8E93',
}

export function groupColor(group: string): string {
  return GROUP_COLORS[group] ?? '#8E8E93'
}

/** i18n label key for each summary row. */
export const SUMMARY_LABEL_KEYS: Record<ExifSummaryId, I18nKey> = {
  dimensions: 'exif.summary.dimensions',
  camera: 'exif.summary.camera',
  lens: 'exif.summary.lens',
  dateTime: 'exif.summary.dateTime',
  iso: 'exif.summary.iso',
  shutter: 'exif.summary.shutter',
  aperture: 'exif.summary.aperture',
  focalLength: 'exif.summary.focalLength',
  gps: 'exif.summary.gps',
  description: 'exif.summary.description',
  artist: 'exif.summary.artist',
  copyright: 'exif.summary.copyright',
  comment: 'exif.summary.comment',
  uniqueId: 'exif.summary.uniqueId',
}

/** Accent for a summary row value. Date and the GPS-presence badge share the orange privacy tone. */
export function summaryValueColor(id: ExifSummaryId): string | undefined {
  if (id === 'gps' || id === 'dateTime') return '#FF9F0A'
  return undefined
}
