// Naming template engine (PRD §6.7). Pure logic: turn a template like `{date}_{nr:001}.{ext}` and a
// resolved context into a file name. The main process assembles the context (hashing/stat/dimensions)
// and calls `formatName`; this module never touches the filesystem.

/** Values a template can reference. Optional fields render as an empty string when absent. */
export interface NamingContext {
  /** Original base name, without extension. */
  name: string
  /** Original extension, without the dot (e.g. `jpg`). */
  ext: string
  md5?: string
  sha1?: string
  /** Current date, `YYYY-MM-DD`. */
  date: string
  /** Current time, `HH-mm-ss`. */
  time: string
  /** File modified time, `YYYY-MM-DD` (or any preformatted string the caller chooses). */
  mtime?: string
  width?: number
  height?: number
  /** 1-based queue position (`{index}`). */
  index: number
  /** Sequence value for `{nr:NNN}` (the caller offsets by the sort ordinal + start). */
  nr: number
}

/** Left-pad a non-negative integer to `width` digits. */
export function padNumber(n: number, width: number): string {
  return String(Math.max(0, Math.trunc(n))).padStart(Math.max(0, width), '0')
}

const opt = (v: string | number | undefined): string => (v === undefined ? '' : String(v))

/**
 * Resolve a naming template against a context.
 * - Supported tokens: `{name} {ext} {md5} {sha1} {date} {time} {mtime} {width} {height} {index}`
 *   and `{nr}` / `{nr:001}` (the digit run after the colon sets the zero-pad width).
 * - Unknown `{...}` tokens are left verbatim so a typo is visible rather than silently dropped.
 */
export function formatName(template: string, ctx: NamingContext): string {
  return template.replace(/\{(\w+)(?::(\d+))?\}/g, (whole, token: string, pad?: string) => {
    switch (token) {
      case 'name':
        return ctx.name
      case 'ext':
        return ctx.ext
      case 'md5':
        return opt(ctx.md5)
      case 'sha1':
        return opt(ctx.sha1)
      case 'date':
        return ctx.date
      case 'time':
        return ctx.time
      case 'mtime':
        return opt(ctx.mtime)
      case 'width':
        return opt(ctx.width)
      case 'height':
        return opt(ctx.height)
      case 'index':
        return String(ctx.index)
      case 'nr':
        return padNumber(ctx.nr, pad ? pad.length : 1)
      default:
        return whole
    }
  })
}

/** The set of base token names a template references — lets the caller hash only when needed. */
export function tokensIn(template: string): Set<string> {
  const tokens = new Set<string>()
  for (const m of template.matchAll(/\{(\w+)(?::\d+)?\}/g)) tokens.add(m[1] as string)
  return tokens
}

/** True if resolving `template` would require a content hash (so the caller can skip hashing). */
export function templateNeedsHash(template: string): { md5: boolean; sha1: boolean } {
  const t = tokensIn(template)
  return { md5: t.has('md5'), sha1: t.has('sha1') }
}

// Characters illegal in file names on Windows (a superset of POSIX needs). Spaces and hyphens are
// legal and preserved. Control characters (code point < 32) are checked separately by code point to
// sidestep regex-escape pitfalls.
const ILLEGAL_FILENAME_CHARS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*'])

const isIllegalChar = (ch: string): boolean =>
  ILLEGAL_FILENAME_CHARS.has(ch) || (ch.codePointAt(0) ?? 32) < 32

/**
 * Make a string safe to use as a file name across platforms: drop illegal/control characters and
 * trailing dots/spaces (rejected by Windows). May return an empty string if nothing survives — the
 * caller decides how to treat that (the save service falls back to the original name).
 */
export function sanitizeFilename(name: string): string {
  let out = ''
  for (const ch of name) if (!isIllegalChar(ch)) out += ch
  return out.replace(/[. ]+$/, '').trim()
}

/** Whether a name is free of illegal characters and non-empty (used by the rename planner). */
export function isValidFilename(name: string): boolean {
  if (name.length === 0 || /[. ]$/.test(name)) return false
  for (const ch of name) if (isIllegalChar(ch)) return false
  return true
}
