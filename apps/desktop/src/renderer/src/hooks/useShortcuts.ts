import type { MultiViewMode } from '@folio/shared-types'
import { useEffect } from 'react'
import {
  advance,
  copyImageCurrent,
  copyPathCurrent,
  quickSaveCurrent,
  toggleFullscreen,
  trashCurrent,
} from '../lib/actions'
import { useExifStore } from '../stores/exifStore'
import { useMultiViewStore } from '../stores/multiViewStore'
import { useQueueStore } from '../stores/queueStore'
import { useUiStore } from '../stores/uiStore'
import { useViewerStore } from '../stores/viewerStore'

function isEditable(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

// Cap how fast held arrow keys (OS key-repeat fires ~30/s) walk the queue, so navigation can't
// outrun image loading. Single steps are lighter than a whole group, so they're allowed faster.
const NAV_THROTTLE_SINGLE_MS = 100
const NAV_THROTTLE_GROUP_MS = 150

/** ⌘/Ctrl + digit → mode. */
const MODE_BY_DIGIT: Record<string, MultiViewMode> = {
  '1': 'single',
  '2': 'dual',
  '3': 'triple',
  '4': 'quad',
}

/** Global keyboard shortcuts for the viewer + multi-view (PRD §7.1 / §6.2). Reads stores lazily. */
export function useShortcuts(): void {
  useEffect(() => {
    // Min-interval gate shared by the navigation keys; persists across events via this closure.
    let lastNavTs = 0
    const onKey = (e: KeyboardEvent): void => {
      // Returns true (and records the time) when enough has elapsed since the last navigation step.
      const navOk = (intervalMs: number): boolean => {
        if (e.timeStamp - lastNavTs < intervalMs) return false
        lastNavTs = e.timeStamp
        return true
      }
      if (isEditable(e.target)) return
      if (useUiStore.getState().activeView !== 'viewer') return
      const queue = useQueueStore.getState()
      const viewer = useViewerStore.getState()
      const mv = useMultiViewStore.getState()
      const multi = mv.mode !== 'single'
      const mod = e.metaKey || e.ctrlKey

      if (mod) {
        if (e.key === 'c' || e.key === 'C') {
          e.preventDefault()
          if (e.shiftKey) void copyPathCurrent()
          else void copyImageCurrent()
        } else if (MODE_BY_DIGIT[e.key]) {
          e.preventDefault()
          mv.setMode(MODE_BY_DIGIT[e.key] as MultiViewMode)
        }
        return // leave other accelerators (menu shortcuts) alone
      }

      switch (e.key) {
        // Left/Right step one image (within the group, then into the next); Shift jumps a whole
        // group. Up/Down jump whole groups. In single mode all of these are prev/next image.
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault()
          // Plain step offers the next folder at the queue's end; Shift always jumps a group.
          if (e.shiftKey) {
            if (navOk(NAV_THROTTLE_GROUP_MS)) mv.nextGroup()
          } else if (navOk(NAV_THROTTLE_SINGLE_MS)) void advance()
          break
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault()
          if (e.shiftKey) {
            if (navOk(NAV_THROTTLE_GROUP_MS)) mv.prevGroup()
          } else if (navOk(NAV_THROTTLE_SINGLE_MS)) mv.prevImage()
          break
        case 'ArrowDown':
          e.preventDefault()
          if (navOk(NAV_THROTTLE_GROUP_MS)) mv.nextGroup()
          break
        case 'ArrowUp':
          e.preventDefault()
          if (navOk(NAV_THROTTLE_GROUP_MS)) mv.prevGroup()
          break
        case 'Home':
          e.preventDefault()
          queue.first()
          break
        case 'End':
          e.preventDefault()
          queue.last()
          break
        case 'Tab':
          if (multi) {
            e.preventDefault()
            if (e.shiftKey) mv.focusPrev()
            else mv.focusNext()
          }
          break
        case '1':
        case '2':
        case '3':
        case '4':
          if (multi) {
            e.preventDefault()
            mv.focusSlot(Number(e.key) - 1)
          }
          break
        case 'v':
        case 'V':
          e.preventDefault()
          mv.cycleMode()
          break
        case 's':
        case 'S':
          if (multi) {
            e.preventDefault()
            mv.toggleSync()
          }
          break
        case 'Enter':
          if (multi) {
            e.preventDefault()
            // Toggle: grid → focused single, focused single → grid (mirrors double-click).
            if (mv.expanded) mv.collapse()
            else mv.expand()
          }
          break
        case 'i':
        case 'I':
          e.preventDefault()
          useExifStore.getState().toggle()
          break
        case 'Escape':
          if (mv.expanded) {
            e.preventDefault()
            mv.collapse()
          } else if (useExifStore.getState().open) {
            e.preventDefault()
            useExifStore.getState().close()
          }
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
        case 't':
        case 'T':
          // Quick save (transfer) the focused image to the remembered folder; first use asks.
          e.preventDefault()
          void quickSaveCurrent()
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
