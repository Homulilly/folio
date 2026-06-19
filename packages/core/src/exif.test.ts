import { describe, expect, it } from 'vitest'
import {
  buildExifGroups,
  exifToJsonString,
  filterExifGroups,
  stringifyExifValue,
  summarizeExif,
} from './exif'

// A representative slice of an ExifTool `-G0` (family-0) raw read.
const RAW = {
  SourceFile: '/photos/a.jpg',
  errors: [],
  'File:FileName': 'a.jpg',
  'File:ImageWidth': 4032,
  'File:ImageHeight': 3024,
  'EXIF:Make': 'Canon',
  'EXIF:Model': 'Canon EOS R5',
  'EXIF:ISO': 400,
  'EXIF:FNumber': 2.8,
  'EXIF:ExposureTime': '1/250',
  'EXIF:FocalLength': '50.0 mm',
  'EXIF:LensModel': 'RF50mm F1.2 L USM',
  'EXIF:DateTimeOriginal': '2026:06:20 11:30:00',
  'EXIF:UserComment': '',
  'Composite:ImageSize': '4032x3024',
  'Composite:Aperture': 2.8,
  'Composite:ShutterSpeed': '1/250',
  'Composite:GPSPosition': '35.6895 N, 139.6917 E',
  'GPS:GPSLatitude': '35 deg 41',
  'XMP:Rating': 5,
  'XMP:Subject': ['travel', 'tokyo'],
}

describe('stringifyExifValue', () => {
  it('renders scalars, arrays, and nested objects', () => {
    expect(stringifyExifValue(400)).toBe('400')
    expect(stringifyExifValue(['travel', 'tokyo'])).toBe('travel, tokyo')
    expect(stringifyExifValue({ a: 1 })).toBe('{"a":1}')
    expect(stringifyExifValue(null)).toBe('')
    expect(stringifyExifValue(undefined)).toBe('')
  })
})

describe('buildExifGroups', () => {
  const groups = buildExifGroups(RAW)
  const names = groups.map((g) => g.group)

  it('drops envelope keys and empty values', () => {
    expect(names).not.toContain('SourceFile')
    const exif = groups.find((g) => g.group === 'EXIF')
    expect(exif?.entries.find((e) => e.key === 'UserComment')).toBeUndefined()
  })

  it('strips the group prefix from field keys', () => {
    const exif = groups.find((g) => g.group === 'EXIF')
    expect(exif?.entries.find((e) => e.key === 'Make')?.value).toBe('Canon')
  })

  it('orders known groups by the preferred order', () => {
    expect(names.indexOf('File')).toBeLessThan(names.indexOf('EXIF'))
    expect(names.indexOf('EXIF')).toBeLessThan(names.indexOf('GPS'))
  })

  it('keeps a group with no prefix under File', () => {
    const groupsNoPrefix = buildExifGroups({ Orphan: 'x' })
    expect(groupsNoPrefix[0]?.group).toBe('File')
    expect(groupsNoPrefix[0]?.entries[0]).toEqual({ key: 'Orphan', value: 'x' })
  })
})

describe('summarizeExif', () => {
  const rows = summarizeExif(buildExifGroups(RAW))
  const byId = Object.fromEntries(rows.map((r) => [r.id, r.value]))

  it('collapses Make + Model without duplicating the make', () => {
    expect(byId.camera).toBe('Canon EOS R5')
  })

  it('prefers Composite friendly values for shutter/aperture/dimensions/gps', () => {
    expect(byId.dimensions).toBe('4032x3024')
    expect(byId.aperture).toBe('2.8')
    expect(byId.shutter).toBe('1/250')
    expect(byId.gps).toBe('35.6895 N, 139.6917 E')
  })

  it('omits rows with no data', () => {
    const sparse = summarizeExif(buildExifGroups({ 'EXIF:Make': 'Nikon' }))
    expect(sparse.map((r) => r.id)).toEqual(['camera'])
  })

  it('joins make + model when model does not start with make', () => {
    const rows2 = summarizeExif(buildExifGroups({ 'EXIF:Make': 'NIKON', 'EXIF:Model': 'Z9' }))
    expect(rows2.find((r) => r.id === 'camera')?.value).toBe('NIKON Z9')
  })
})

describe('filterExifGroups', () => {
  const groups = buildExifGroups(RAW)

  it('returns all groups for an empty query', () => {
    expect(filterExifGroups(groups, '  ')).toBe(groups)
  })

  it('matches field name or value, dropping empty groups', () => {
    const r = filterExifGroups(groups, 'canon')
    expect(r.every((g) => g.entries.length > 0)).toBe(true)
    expect(r.flatMap((g) => g.entries).some((e) => e.value.includes('Canon'))).toBe(true)
  })

  it('keeps the whole group when the group name matches', () => {
    const r = filterExifGroups(groups, 'gps')
    const gps = r.find((g) => g.group === 'GPS')
    expect(gps?.entries.length).toBe(groups.find((g) => g.group === 'GPS')?.entries.length)
  })
})

describe('exifToJsonString', () => {
  it('serialises to nested group → key → value JSON', () => {
    const json = JSON.parse(
      exifToJsonString({ filePath: '/photos/a.jpg', groups: buildExifGroups(RAW) }),
    )
    expect(json.EXIF.Make).toBe('Canon')
    expect(json.XMP.Subject).toBe('travel, tokyo')
  })
})
