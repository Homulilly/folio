import { create } from 'zustand'

export type ToastTone = 'info' | 'success' | 'error'

interface ToastState {
  message: string | null
  tone: ToastTone
  show: (message: string, tone?: ToastTone) => void
  hide: () => void
}

let timer: ReturnType<typeof setTimeout> | null = null

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  tone: 'info',
  show: (message, tone = 'info') => {
    if (timer) clearTimeout(timer)
    set({ message, tone })
    timer = setTimeout(() => set({ message: null }), 2400)
  },
  hide: () => {
    if (timer) clearTimeout(timer)
    set({ message: null })
  },
}))
