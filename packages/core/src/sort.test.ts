import type { ImageQueueItem } from '@folio/shared-types'
import { describe, expect, it } from 'vitest'
import { sortItems } from './sort'

function item(partial: Partial<ImageQueueItem> & { fileName: string }): ImageQueueItem {
  return {
    id: partial.fileName,
    filePath: `/x/${partial.fileName}`,
    ext: partial.fileName.split('.').pop() ?? '',
    size: 0,
    modifiedAt: 0,
    metadataStatus: 'pending',
    ...partial,
  }
}

describe('sortItems', () => {
  it('sorts names naturally and case-insensitively (img2 before img10)', () => {
    const items = [item({ fileName: 'img10.jpg' }), item({ fileName: 'IMG2.jpg' })]
    expect(sortItems(items, 'name_asc').map((i) => i.fileName)).toEqual(['IMG2.jpg', 'img10.jpg'])
  })

  it('sorts by size ascending and descending', () => {
    const items = [
      item({ fileName: 'a.jpg', size: 30 }),
      item({ fileName: 'b.jpg', size: 10 }),
      item({ fileName: 'c.jpg', size: 20 }),
    ]
    expect(sortItems(items, 'size_asc').map((i) => i.size)).toEqual([10, 20, 30])
    expect(sortItems(items, 'size_desc').map((i) => i.size)).toEqual([30, 20, 10])
  })

  it('falls back to created=modified when createdAt is absent', () => {
    const items = [
      item({ fileName: 'a.jpg', modifiedAt: 200 }),
      item({ fileName: 'b.jpg', modifiedAt: 100 }),
    ]
    expect(sortItems(items, 'created_asc').map((i) => i.fileName)).toEqual(['b.jpg', 'a.jpg'])
  })

  it('does not mutate the input array', () => {
    const items = [item({ fileName: 'b.jpg' }), item({ fileName: 'a.jpg' })]
    const before = items.map((i) => i.fileName)
    sortItems(items, 'name_asc')
    expect(items.map((i) => i.fileName)).toEqual(before)
  })

  it('breaks ties deterministically by name', () => {
    const items = [item({ fileName: 'b.jpg', size: 5 }), item({ fileName: 'a.jpg', size: 5 })]
    expect(sortItems(items, 'size_asc').map((i) => i.fileName)).toEqual(['a.jpg', 'b.jpg'])
  })
})
