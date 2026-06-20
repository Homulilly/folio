import { describe, expect, it } from 'vitest'
import {
  formatName,
  isValidFilename,
  type NamingContext,
  padNumber,
  sanitizeFilename,
  templateNeedsHash,
  tokensIn,
} from './naming'

const ctx = (over: Partial<NamingContext> = {}): NamingContext => ({
  name: 'IMG_0001',
  ext: 'jpg',
  date: '2026-06-20',
  time: '14-30-00',
  index: 3,
  nr: 5,
  ...over,
})

describe('padNumber', () => {
  it('zero-pads to width', () => {
    expect(padNumber(5, 3)).toBe('005')
    expect(padNumber(123, 3)).toBe('123')
    expect(padNumber(1234, 3)).toBe('1234') // never truncates
  })
})

describe('formatName', () => {
  it('substitutes basic tokens', () => {
    expect(formatName('{name}.{ext}', ctx())).toBe('IMG_0001.jpg')
    expect(formatName('{date}_{time}.{ext}', ctx())).toBe('2026-06-20_14-30-00.jpg')
  })

  it('pads {nr:NNN} by the digit count and uses the nr value', () => {
    expect(formatName('{nr:001}.{ext}', ctx({ nr: 7 }))).toBe('007.jpg')
    expect(formatName('{nr:00001}.{ext}', ctx({ nr: 42 }))).toBe('00042.jpg')
    expect(formatName('{nr}.{ext}', ctx({ nr: 7 }))).toBe('7.jpg')
  })

  it('renders {index} unpadded', () => {
    expect(formatName('{index}.{ext}', ctx({ index: 12 }))).toBe('12.jpg')
  })

  it('substitutes hashes and dimensions when present', () => {
    expect(formatName('{md5}.{ext}', ctx({ md5: 'abc123' }))).toBe('abc123.jpg')
    expect(formatName('{name}_{width}x{height}.{ext}', ctx({ width: 800, height: 600 }))).toBe(
      'IMG_0001_800x600.jpg',
    )
  })

  it('renders missing optional tokens as empty strings', () => {
    expect(formatName('{md5}{name}.{ext}', ctx())).toBe('IMG_0001.jpg')
    expect(formatName('{name}_{width}.{ext}', ctx())).toBe('IMG_0001_.jpg')
  })

  it('leaves unknown tokens verbatim', () => {
    expect(formatName('{bogus}_{name}', ctx())).toBe('{bogus}_IMG_0001')
  })
})

describe('tokensIn / templateNeedsHash', () => {
  it('collects base token names', () => {
    expect([...tokensIn('{date}_{nr:001}.{ext}')].sort()).toEqual(['date', 'ext', 'nr'])
  })

  it('detects which hashes a template needs', () => {
    expect(templateNeedsHash('{md5}.{ext}')).toEqual({ md5: true, sha1: false })
    expect(templateNeedsHash('{name}.{ext}')).toEqual({ md5: false, sha1: false })
    expect(templateNeedsHash('{sha1}-{md5}')).toEqual({ md5: true, sha1: true })
  })
})

describe('sanitizeFilename', () => {
  it('drops illegal characters but keeps spaces and hyphens', () => {
    expect(sanitizeFilename('a/b:c*d?.jpg')).toBe('abcd.jpg')
    expect(sanitizeFilename('my photo - 1.jpg')).toBe('my photo - 1.jpg')
  })

  it('trims trailing dots and spaces', () => {
    expect(sanitizeFilename('name.  ')).toBe('name')
    expect(sanitizeFilename('  name  ')).toBe('name')
  })

  it('can return empty when nothing survives', () => {
    expect(sanitizeFilename('///')).toBe('')
  })
})

describe('isValidFilename', () => {
  it('accepts normal names', () => {
    expect(isValidFilename('IMG_0001.jpg')).toBe(true)
    expect(isValidFilename('my photo - 1.jpg')).toBe(true)
  })

  it('rejects empty, illegal chars, and trailing dot/space', () => {
    expect(isValidFilename('')).toBe(false)
    expect(isValidFilename('a/b.jpg')).toBe(false)
    expect(isValidFilename('a?.jpg')).toBe(false)
    expect(isValidFilename('name ')).toBe(false)
    expect(isValidFilename('name.')).toBe(false)
  })
})
