import { create } from 'zustand'

const ZOOM_MIN = 10
const ZOOM_MAX = 800
// Button/keyboard zoom steps geometrically so the perceived increment is constant at any
// magnification (matching the wheel's multiplicative zoom), instead of a fixed +/-% that
// feels huge when small and negligible when large.
const ZOOM_STEP_FACTOR = 1.25

interface ViewerState {
  /** When true, the image is scaled to fit the canvas; otherwise `zoom` (%) of natural size. */
  fit: boolean
  zoom: number
  rotation: 0 | 90 | 180 | 270
  naturalWidth: number | null
  naturalHeight: number | null
  /** Canvas viewport size, reported by the Canvas — needed to compute the fit scale. */
  viewportWidth: number | null
  viewportHeight: number | null

  setNatural: (w: number, h: number) => void
  setViewport: (w: number, h: number) => void
  reset: () => void
  toggleFit: () => void
  fitWindow: () => void
  /** Fit for grid mode: drops single-image geometry so zoom resumes from a 100% baseline. */
  fitForGrid: () => void
  originalSize: () => void
  zoomIn: () => void
  zoomOut: () => void
  /** Multiply current zoom by a scale factor (mouse wheel / pinch style); leaves fit mode. */
  zoomByFactor: (factor: number) => void
  rotateCW: () => void
  resetRotation: () => void
}

const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z))

/**
 * The percentage at which the image is *actually* displayed in fit mode — i.e. how
 * object-contain scales it into the viewport, never upscaling past 100% (matches the
 * `max-h/max-w-full` render). Falls back to 100% before sizes are known. This is what zoom
 * operations resume from, so a huge image shown at 12% zooms from 12%, not a jump to 100%.
 */
function fitPercent(s: ViewerState): number {
  const { naturalWidth: nw, naturalHeight: nh, viewportWidth: vw, viewportHeight: vh } = s
  if (!nw || !nh || !vw || !vh) return 100
  // Rotation by 90/270 swaps which natural side bounds each viewport axis.
  const rotated = s.rotation === 90 || s.rotation === 270
  const boundW = rotated ? nh : nw
  const boundH = rotated ? nw : nh
  return clampZoom(Math.min(1, vw / boundW, vh / boundH) * 100)
}

/** Current displayed percentage, whether in fit mode or explicit zoom. */
const currentPercent = (s: ViewerState): number => (s.fit ? fitPercent(s) : s.zoom)

export const useViewerStore = create<ViewerState>((set) => ({
  fit: true,
  zoom: 100,
  rotation: 0,
  naturalWidth: null,
  naturalHeight: null,
  viewportWidth: null,
  viewportHeight: null,

  setNatural: (naturalWidth, naturalHeight) => set({ naturalWidth, naturalHeight }),
  setViewport: (viewportWidth, viewportHeight) => set({ viewportWidth, viewportHeight }),
  reset: () => set({ fit: true, zoom: 100, rotation: 0, naturalWidth: null, naturalHeight: null }),
  toggleFit: () => set((s) => ({ fit: !s.fit, zoom: 100 })),
  fitWindow: () => set({ fit: true, zoom: 100 }),
  // Grid zoom is scale(zoom/100) over each cell's contain-fit, so the fit baseline is 100%, not a
  // fraction of natural pixels. Clearing the (single-image) geometry makes fitPercent fall back to
  // 100, so button/keyboard zoom resumes from the displayed size instead of a stale single-view %.
  fitForGrid: () =>
    set({
      fit: true,
      zoom: 100,
      naturalWidth: null,
      naturalHeight: null,
      viewportWidth: null,
      viewportHeight: null,
    }),
  originalSize: () => set({ fit: false, zoom: 100 }),
  zoomIn: () => set((s) => ({ fit: false, zoom: clampZoom(currentPercent(s) * ZOOM_STEP_FACTOR) })),
  zoomOut: () =>
    set((s) => ({ fit: false, zoom: clampZoom(currentPercent(s) / ZOOM_STEP_FACTOR) })),
  zoomByFactor: (factor) =>
    set((s) => ({
      fit: false,
      zoom: clampZoom(currentPercent(s) * (Number.isFinite(factor) ? factor : 1)),
    })),
  rotateCW: () => set((s) => ({ rotation: ((s.rotation + 90) % 360) as 0 | 90 | 180 | 270 })),
  resetRotation: () => set({ rotation: 0 }),
}))
