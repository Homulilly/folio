import { useEffect } from 'react'
import { copyImageCurrent, copyPathCurrent, toggleFullscreen, trashCurrent } from '../lib/actions'
import { useQueueStore } from '../stores/queueStore'
import { useViewerStore } from '../stores/viewerStore'

function isEditable(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/** Global keyboard shortcuts for the viewer (PRD §7.1). Reads stores lazily to avoid stale closures. */
export function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (isEditable(e.target)) return
      const queue = useQueueStore.getState()
      const viewer = useViewerStore.getState()
      const mod = e.metaKey || e.ctrlKey

      if (mod && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault()
        if (e.shiftKey) void copyPathCurrent()
        else void copyImageCurrent()
        return
      }
      if (mod) return // leave other accelerators (menu shortcuts) alone

      switch (e.key) {
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault()
          queue.next()
          break
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault()
          queue.prev()
          break
        case 'Home':
          e.preventDefault()
          queue.first()
          break
        case 'End':
          e.preventDefault()
          queue.last()
          break
        case '+':
        case '=':
          e.preventDefault()
          viewer.zoomIn()
          break
        case '-':
        case '_':
          e.preventDefault()
          viewer.zoomOut()
          break
        case '0':
          e.preventDefault()
          viewer.originalSize()
          break
        case ' ':
          e.preventDefault()
          viewer.toggleFit()
          break
        case 'f':
        case 'F':
          e.preventDefault()
          viewer.fitWindow()
          break
        case 'r':
          e.preventDefault()
          viewer.rotateCW()
          break
        case 'R':
          e.preventDefault()
          queue.random()
          break
        case 'F11':
          e.preventDefault()
          void toggleFullscreen()
          break
        case 'Delete':
        case 'Backspace':
          e.preventDefault()
          void trashCurrent()
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
