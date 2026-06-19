import { create } from 'zustand'

interface TrashConfirmRequest {
  fileName: string
  resolve: (confirmed: boolean) => void
}

interface TrashConfirmState {
  request: TrashConfirmRequest | null
  skipUntilRestart: boolean
  confirmTrash: (fileName: string) => Promise<boolean>
  accept: (skipUntilRestart: boolean) => void
  cancel: () => void
}

export const useTrashConfirmStore = create<TrashConfirmState>((set, get) => ({
  request: null,
  skipUntilRestart: false,

  confirmTrash: (fileName) => {
    if (get().skipUntilRestart) return Promise.resolve(true)
    if (get().request) return Promise.resolve(false)

    return new Promise<boolean>((resolve) => {
      set({ request: { fileName, resolve } })
    })
  },

  accept: (skipUntilRestart) => {
    const { request } = get()
    if (!request) return
    set((s) => ({ request: null, skipUntilRestart: s.skipUntilRestart || skipUntilRestart }))
    request.resolve(true)
  },

  cancel: () => {
    const { request } = get()
    if (!request) return
    set({ request: null })
    request.resolve(false)
  },
}))
