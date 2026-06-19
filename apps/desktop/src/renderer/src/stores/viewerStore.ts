import { create } from 'zustand'

const ZOOM_MIN = 10
const ZOOM_MAX = 800
const ZOOM_STEP = 25

interface ViewerState {
  /** When true, the image is scaled to fit the canvas; otherwise `zoom` (%) of natural size. */
  fit: boolean
  zoom: number
  rotation: 0 | 90 | 180 | 270
  naturalWidth: number | null
  naturalHeight: number | null

  setNatural: (w: number, h: number) => void
  reset: () => void
  toggleFit: () => void
  fitWindow: () => void
  originalSize: () => void
  zoomIn: () => void
  zoomOut: () => void
  rotateCW: () => void
}

const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z))

export const useViewerStore = create<ViewerState>((set) => ({
  fit: true,
  zoom: 100,
  rotation: 0,
  naturalWidth: null,
  naturalHeight: null,

  setNatural: (naturalWidth, naturalHeight) => set({ naturalWidth, naturalHeight }),
  reset: () => set({ fit: true, zoom: 100, rotation: 0, naturalWidth: null, naturalHeight: null }),
  toggleFit: () => set((s) => ({ fit: !s.fit, zoom: 100 })),
  fitWindow: () => set({ fit: true, zoom: 100 }),
  originalSize: () => set({ fit: false, zoom: 100 }),
  zoomIn: () => set((s) => ({ fit: false, zoom: clampZoom((s.fit ? 100 : s.zoom) + ZOOM_STEP) })),
  zoomOut: () => set((s) => ({ fit: false, zoom: clampZoom((s.fit ? 100 : s.zoom) - ZOOM_STEP) })),
  rotateCW: () => set((s) => ({ rotation: ((s.rotation + 90) % 360) as 0 | 90 | 180 | 270 })),
}))
