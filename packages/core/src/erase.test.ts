import type { ExifGroup } from '@folio/shared-types'
import { describe, expect, it } from 'vitest'
import {
  buildRemoveArgs,
  ERASE_CATEGORIES,
  isValidTagPattern,
  matchesTagPattern,
  partitionExifByRule,
  presetRule,
  tagsForCategories,
  validateRule,
  verifyRemoval,
} from './erase'

describe('tagsForCategories', () => {
  it('flattens and de-duplicates category patterns', () => {
    const tags = tagsForCategories(['gps', 'device'])
    expect(tags).toContain('GPS:all')
    expect(tags).toContain('Make')
    expect(new Set(tags).size).toBe(tags.length)
  })
})

describe('presetRule', () => {
  it('privacy removes gps/device/dates/software/thumbnail, keeps the rest', () => {
    const r = presetRule('privacy')
    expect(r.mode).toBe('remove_selected')
    expect(r.removeTags).toContain('GPS:all')
    expect(r.removeTags).toContain('DateTimeOriginal')
    expect(r.removeTags).toContain('ThumbnailImage')
    expect(r.removeTags).not.toContain('Copyright') // identity not stripped in privacy
  })

  it('share keeps only orientation/colour baseline', () => {
    const r = presetRule('share')
    expect(r.mode).toBe('remove_all_except_keep')
    expect(r.keepTags).toContain('Orientation')
    expect(r.keepTags).toContain('ICC_Profile')
  })

  it('full strips everything (no keep)', () => {
    const r = presetRule('full')
    expect(r.mode).toBe('remove_all_except_keep')
    expect(r.keepTags).toEqual([])
  })

  it('copyright removes gps/device but retains copyright/author/icc', () => {
    const r = presetRule('copyright')
    expect(r.removeTags).toContain('GPS:all')
    expect(r.removeTags).toContain('Make')
    expect(r.keepTags).toContain('Copyright')
    expect(r.removeTags).not.toContain('Copyright')
  })

  it('custom is an empty remove_selected rule', () => {
    expect(presetRule('custom')).toEqual({ mode: 'remove_selected', removeTags: [], keepTags: [] })
  })
})

describe('isValidTagPattern / validateRule', () => {
  it('accepts ExifTool tag patterns', () => {
    expect(isValidTagPattern('GPS:all')).toBe(true)
    expect(isValidTagPattern('*Serial*')).toBe(true)
    expect(isValidTagPattern('DateTimeOriginal')).toBe(true)
  })

  it('rejects injection-ish / malformed tokens', () => {
    expect(isValidTagPattern('GPS= -delete_original!')).toBe(false)
    expect(isValidTagPattern('a b')).toBe(false)
    expect(isValidTagPattern('')).toBe(false)
  })

  it('flags invalid tags in a rule', () => {
    const res = validateRule({
      mode: 'remove_selected',
      removeTags: ['Make', 'bad tag'],
      keepTags: [],
    })
    expect(res.valid).toBe(false)
    expect(res.invalid).toEqual(['bad tag'])
  })

  it('every built-in category pattern is valid', () => {
    for (const patterns of Object.values(ERASE_CATEGORIES))
      for (const p of patterns) expect(isValidTagPattern(p)).toBe(true)
  })
})

describe('buildRemoveArgs', () => {
  it('maps remove_selected tags to -tag= args (caller adds overwrite flag)', () => {
    const args = buildRemoveArgs({
      mode: 'remove_selected',
      removeTags: ['GPS:all', 'Make'],
      keepTags: [],
    })
    expect(args).toEqual(['-GPS:all=', '-Make='])
  })

  it('returns nothing for keep-only mode (handled via deleteAllTags)', () => {
    expect(
      buildRemoveArgs({
        mode: 'remove_all_except_keep',
        removeTags: [],
        keepTags: ['Orientation'],
      }),
    ).toEqual([])
  })
})

describe('matchesTagPattern', () => {
  it('matches Group:all against the group', () => {
    expect(matchesTagPattern('GPS', 'GPSLatitude', 'GPS:all')).toBe(true)
    expect(matchesTagPattern('EXIF', 'Make', 'GPS:all')).toBe(false)
  })
  it('matches wildcards against the key', () => {
    expect(matchesTagPattern('EXIF', 'LensSerialNumber', '*Serial*')).toBe(true)
    expect(matchesTagPattern('EXIF', 'Make', '*Serial*')).toBe(false)
  })
  it('matches exact tag names case-insensitively', () => {
    expect(matchesTagPattern('EXIF', 'Make', 'make')).toBe(true)
    expect(matchesTagPattern('EXIF', 'Model', 'Make')).toBe(false)
  })
})

describe('partitionExifByRule', () => {
  const groups = [
    {
      group: 'EXIF',
      entries: [
        { key: 'Make', value: 'Canon' },
        { key: 'Orientation', value: '1' },
      ],
    },
    { group: 'GPS', entries: [{ key: 'GPSLatitude', value: '35' }] },
  ]

  it('remove_selected: removes matching fields, keeps the rest', () => {
    const { removed, keptCount } = partitionExifByRule(groups, {
      mode: 'remove_selected',
      removeTags: ['GPS:all', 'Make'],
      keepTags: [],
    })
    expect(removed).toEqual([
      { group: 'EXIF', key: 'Make' },
      { group: 'GPS', key: 'GPSLatitude' },
    ])
    expect(keptCount).toBe(1) // Orientation
  })

  it('keep-only: removes everything outside keep + baseline', () => {
    const { removed, keptCount } = partitionExifByRule(groups, {
      mode: 'remove_all_except_keep',
      removeTags: [],
      keepTags: [],
    })
    expect(removed.map((r) => r.key)).toContain('Make')
    expect(removed.map((r) => r.key)).toContain('GPSLatitude')
    expect(removed.map((r) => r.key)).not.toContain('Orientation') // baseline kept
    expect(keptCount).toBe(1)
  })
})

describe('verifyRemoval', () => {
  const groups = (entries: Record<string, string>): ExifGroup[] => [
    { group: 'EXIF', entries: Object.entries(entries).map(([key, value]) => ({ key, value })) },
  ]

  it('confirms concrete removed tags are gone and flags survivors', () => {
    const rule = { mode: 'remove_selected' as const, removeTags: ['Make', 'Model'], keepTags: [] }
    const res = verifyRemoval(rule, groups({ Model: 'EOS R5', Orientation: '1' }))
    expect(res.verifiedRemoved).toContain('Make')
    expect(res.stillPresent).toContain('Model')
  })

  it('skips wildcard/:all patterns (best-effort, not asserted present)', () => {
    const rule = {
      mode: 'remove_selected' as const,
      removeTags: ['GPS:all', '*Serial*'],
      keepTags: [],
    }
    const res = verifyRemoval(rule, groups({ Orientation: '1' }))
    expect(res.stillPresent).toEqual([])
  })

  it('keep-only mode flags anything outside the keep + baseline set', () => {
    const rule = {
      mode: 'remove_all_except_keep' as const,
      removeTags: [],
      keepTags: ['Copyright'],
    }
    const res = verifyRemoval(rule, groups({ Copyright: 'me', Orientation: '1', Make: 'Canon' }))
    expect(res.stillPresent).toContain('make')
    expect(res.stillPresent).not.toContain('copyright')
    expect(res.stillPresent).not.toContain('orientation')
  })
})
