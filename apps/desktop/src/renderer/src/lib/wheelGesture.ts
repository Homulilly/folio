/**
 * One discrete step per wheel *gesture*, for trackpad-friendly navigation.
 *
 * The hard case is a trackpad: a single flick emits a long, noisy stream of `deltaMode === 0`
 * (pixel) events that ramp up, peak, then decay over the momentum tail (~0.7s). Stepping per event
 * blasts through many items; a fixed cooldown or "quiet gap only" lockout instead *swallows* the
 * next gentle flick, because a fresh swipe ramps up gradually (6 → 12 → 20) and looks just like the
 * previous flick's tail.
 *
 * So we model the gesture with a low-water mark + hysteresis:
 *  - We step once when armed and the magnitude clears `STEP_ON`, then disarm.
 *  - We track `peak` (max since the step) and `low` (min once past the peak — the decay's low-water).
 *  - We re-arm on a NEW gesture, detected as a clear *rise above the low-water mark* once the
 *    previous flick has actually peaked and decayed (`peak ≥ PEAK_MIN && low < LOW_GUARD`). That
 *    catches a fresh, gradually-ramping swipe even during the old flick's tail, while the
 *    `peak`/`low` guards keep the same flick's own noisy ramp-up from re-arming mid-gesture.
 *  - A quiet gap (`dt > gapMs`) also re-arms — a flick from rest, or a discrete event.
 *
 * Traditional mouse wheels (`deltaMode !== 0`, line/page deltas) are discrete notches, not a
 * momentum stream, so they take a simple per-notch path with a short cooldown instead.
 */
export interface WheelGate {
  armed: boolean
  lastTs: number
  /** Max |delta| since the last step (trackpad) — confirms a real gesture happened before re-arming. */
  peak: number
  /** Min |delta| since the peak (trackpad low-water mark) — the baseline a new rise is measured from. */
  low: number
}

export function createWheelGate(): WheelGate {
  return { armed: true, lastTs: 0, peak: 0, low: 0 }
}

interface WheelLike {
  deltaX: number
  deltaY: number
  /** 0 = pixels (trackpad / precision), 1 = lines, 2 = pages (traditional wheel). */
  deltaMode: number
  /** DOMHighResTimeStamp from the wheel event. */
  timeStamp: number
}

const STEP_ON = 4 // magnitude (px) that counts as an intentional push
const LOW_GUARD = 4 // the decay must fall below this before a rise can re-arm
const RISE_DELTA = 5 // how far above the low-water mark a new push must rise to re-arm
const PEAK_MIN = 10 // a gesture must have peaked at least this high before its decay enables re-arm
const NOTCH_COOLDOWN_MS = 40 // min spacing between traditional-wheel notch steps

/**
 * Decide whether a wheel event should step, and in which direction.
 * @returns 1 to step forward/next, -1 to step back/prev, 0 to ignore this event.
 */
export function wheelStep(gate: WheelGate, e: WheelLike, gapMs: number): -1 | 0 | 1 {
  const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
  const dir: -1 | 0 | 1 = raw > 0 ? 1 : raw < 0 ? -1 : 0
  const dt = e.timeStamp - gate.lastTs
  gate.lastTs = e.timeStamp
  if (dir === 0) return 0

  // Traditional mouse wheel: discrete notches → step each, with a short cooldown to bound a fast
  // free-spin. No gesture model (these aren't a momentum stream).
  if (e.deltaMode !== 0) return dt >= NOTCH_COOLDOWN_MS ? dir : 0

  // Trackpad (pixel) gesture model.
  const mag = Math.abs(raw)
  if (mag > gate.peak) gate.peak = mag
  else if (mag < gate.peak) gate.low = Math.min(gate.low, mag)

  const rise = gate.peak >= PEAK_MIN && gate.low < LOW_GUARD && mag - gate.low >= RISE_DELTA
  if (dt > gapMs) {
    gate.armed = true
    gate.peak = mag
    gate.low = mag
  } else if (rise) {
    gate.armed = true
  }

  if (mag < STEP_ON || !gate.armed) return 0
  gate.armed = false
  gate.peak = mag
  gate.low = mag
  return dir
}
