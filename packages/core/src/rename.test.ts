import type { DeleteOptions, ReplaceOptions, SequenceOptions } from '@folio/shared-types'
import { describe, expect, it } from 'vitest'
import { applyRename, planRename } from './rename'

const replace = (o: Partial<ReplaceOptions>): ReplaceOptions => ({
  kind: 'replace',
  find: '',
  replace: '',
  useRegex: false,
  caseSensitive: false,
  includeExtension: false,
  ...o,
})

const del = (o: Partial<DeleteOptions> & { op: DeleteOptions['op'] }): DeleteOptions => ({
  kind: 'delete',
  includeExtension: false,
  ...o,
})

const seq = (o: Partial<SequenceOptions> = {}): SequenceOptions => ({
  kind: 'sequence',
  prefix: 'Nr',
  separator: ':',
  start: 1,
  padding: 3,
  keepExtension: true,
  ...o,
})

describe('applyRename — replace mode', () => {
  it('replaces a literal substring in the name only (not the extension)', () => {
    expect(applyRename('IMG_001.jpg', replace({ find: 'IMG_', replace: '' }), 0)).toBe('001.jpg')
  })

  it('replaces spaces with underscores', () => {
    expect(applyRename('my photo.jpg', replace({ find: ' ', replace: '_' }), 0)).toBe(
      'my_photo.jpg',
    )
  })

  it('is case-insensitive by default, case-sensitive when asked', () => {
    expect(applyRename('Img.JPG', replace({ find: 'img', replace: 'x' }), 0)).toBe('x.JPG')
    expect(
      applyRename('Img.jpg', replace({ find: 'img', replace: 'x', caseSensitive: true }), 0),
    ).toBe('Img.jpg')
  })

  it('supports regex', () => {
    expect(
      applyRename('IMG_2024_001.jpg', replace({ find: '\\d+', replace: '#', useRegex: true }), 0),
    ).toBe('IMG_#_#.jpg')
  })

  it('falls back to a no-op on invalid regex', () => {
    expect(applyRename('a.jpg', replace({ find: '(', replace: 'x', useRegex: true }), 0)).toBe(
      'a.jpg',
    )
  })

  it('can include the extension when requested', () => {
    expect(
      applyRename('a.jpeg', replace({ find: 'jpeg', replace: 'jpg', includeExtension: true }), 0),
    ).toBe('a.jpg')
  })
})

describe('applyRename — delete mode', () => {
  it('deletes the first N characters', () => {
    expect(applyRename('IMG_001.jpg', del({ op: 'first', count: 4 }), 0)).toBe('001.jpg')
  })

  it('deletes the last N characters of the base', () => {
    expect(applyRename('photo_raw.jpg', del({ op: 'last', count: 4 }), 0)).toBe('photo.jpg')
  })

  it('deletes a range from a 1-based position', () => {
    expect(applyRename('abcdef.jpg', del({ op: 'range', start: 3, count: 2 }), 0)).toBe('abef.jpg')
  })

  it('deletes everything before a marker (marker kept)', () => {
    expect(applyRename('scan-2024.jpg', del({ op: 'before', marker: '2024' }), 0)).toBe('2024.jpg')
  })

  it('deletes everything after a marker (marker kept)', () => {
    expect(applyRename('2024-draft.jpg', del({ op: 'after', marker: '2024' }), 0)).toBe('2024.jpg')
  })
})

describe('applyRename — sequence mode', () => {
  it('numbers from start with padding and separator', () => {
    expect(applyRename('a.jpg', seq(), 0)).toBe('Nr:001.jpg')
    expect(applyRename('b.jpg', seq(), 1)).toBe('Nr:002.jpg')
    expect(applyRename('c.jpg', seq({ start: 10 }), 0)).toBe('Nr:010.jpg')
  })

  it('can drop the extension', () => {
    expect(applyRename('a.jpg', seq({ keepExtension: false }), 0)).toBe('Nr:001')
  })
})

describe('planRename', () => {
  it('marks unchanged ops and counts changes', () => {
    const plan = planRename(['a.jpg', 'b.jpg'], replace({ find: 'a', replace: 'a' }))
    expect(plan.counts.unchanged).toBe(2)
    expect(plan.counts.changed).toBe(0)
    expect(plan.hasBlockingIssues).toBe(false)
  })

  it('flags duplicate targets', () => {
    // Both files collapse to the same target name.
    const plan = planRename(
      ['a1.jpg', 'a2.jpg'],
      replace({ find: '\\d', replace: '', useRegex: true }),
    )
    expect(plan.counts.duplicate).toBe(2)
    expect(plan.hasBlockingIssues).toBe(true)
  })

  it('flags illegal target names', () => {
    const plan = planRename(['a.jpg'], replace({ find: 'a', replace: 'x/y' }))
    expect(plan.ops[0]?.issue).toBe('illegal')
    expect(plan.hasBlockingIssues).toBe(true)
  })

  it('flags collision with an existing untouched file', () => {
    // Rename a.jpg → c.jpg, but c.jpg already exists and is not itself being renamed.
    const plan = planRename(['a.jpg'], replace({ find: 'a', replace: 'c' }), ['a.jpg', 'c.jpg'])
    expect(plan.ops[0]?.issue).toBe('collision')
    expect(plan.hasBlockingIssues).toBe(true)
  })

  it('does NOT flag an A→B / B→A swap as a collision (handled by two-phase exec)', () => {
    // Swap by stripping/adding a suffix isn't expressible with one replace, so simulate via sequence
    // over names whose targets are each other's sources.
    const plan = planRename(
      ['1.jpg', '2.jpg'],
      seq({ prefix: '', separator: '', start: 2, padding: 1 }),
    )
    // 1.jpg → 2.jpg, 2.jpg → 3.jpg : target "2.jpg" equals another source, must NOT be a collision.
    expect(plan.ops[0]?.to).toBe('2.jpg')
    expect(plan.ops[0]?.issue).toBeUndefined()
    expect(plan.hasBlockingIssues).toBe(false)
  })

  it('numbers sequence ops in input order', () => {
    const plan = planRename(['z.jpg', 'a.jpg'], seq())
    expect(plan.ops.map((o) => o.to)).toEqual(['Nr:001.jpg', 'Nr:002.jpg'])
  })
})
