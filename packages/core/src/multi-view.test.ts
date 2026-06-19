import { describe, expect, it } from 'vitest'
import { nextGroupStart, previousGroupStart, viewCountForMode } from './multi-view'

describe('viewCountForMode', () => {
  it('maps each mode to its step size', () => {
    expect(viewCountForMode('single')).toBe(1)
    expect(viewCountForMode('dual')).toBe(2)
    expect(viewCountForMode('triple')).toBe(3)
    expect(viewCountForMode('quad')).toBe(4)
  })
})

describe('nextGroupStart', () => {
  it('advances by the mode step', () => {
    expect(nextGroupStart({ startIndex: 0, mode: 'quad', total: 1000 })).toBe(4)
    expect(nextGroupStart({ startIndex: 20, mode: 'dual', total: 1000 })).toBe(22)
  })

  it('stays put at the end without loop', () => {
    expect(nextGroupStart({ startIndex: 998, mode: 'quad', total: 1000 })).toBe(998)
  })

  it('wraps to start with loop enabled', () => {
    expect(nextGroupStart({ startIndex: 998, mode: 'quad', total: 1000, loop: true })).toBe(0)
  })

  it('returns 0 for an empty queue', () => {
    expect(nextGroupStart({ startIndex: 0, mode: 'single', total: 0 })).toBe(0)
  })
})

describe('previousGroupStart', () => {
  it('steps back by the mode step', () => {
    expect(previousGroupStart({ startIndex: 8, mode: 'quad', total: 1000 })).toBe(4)
  })

  it('stays put at the start without loop', () => {
    expect(previousGroupStart({ startIndex: 0, mode: 'quad', total: 1000 })).toBe(0)
  })

  it('wraps to the last aligned group with loop enabled', () => {
    // total 10, quad step 4 -> last aligned group starts at 8
    expect(previousGroupStart({ startIndex: 0, mode: 'quad', total: 10, loop: true })).toBe(8)
  })
})
