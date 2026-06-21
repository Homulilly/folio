import { isMac, isWindows } from '../lib/platform'
import { useQueueStore } from '../stores/queueStore'

// Reserve space for the native window controls so the centered title never slides underneath.
// Windows paints the min/max/close Controls Overlay top-right; at higher display scaling the three
// buttons run wider than 138px, so leave generous clearance. macOS insets the traffic lights
// top-left (~78px). Padding both sides symmetrically keeps the title visually centered.
const SIDE_INSET = isWindows() ? 150 : isMac() ? 78 : 0

export function TitleBar(): React.JSX.Element {
  const item = useQueueStore((s) => s.items[s.currentIndex])

  return (
    // The Windows Controls Overlay is an opaque 38px band painted top-right by the OS, so it would
    // cover a `border-b` drawn on the bar itself. Keep the bar borderless and draw the divider as a
    // separate full-width 1px strip below it — outside the overlay band, so it stays unbroken.
    <div className="flex-none [-webkit-app-region:drag]">
      <div
        className="flex h-[38px] items-center justify-center bg-[#1C1C1E]"
        style={{ paddingLeft: SIDE_INSET, paddingRight: SIDE_INSET }}
      >
        <span className="truncate px-4 text-[13px] font-semibold text-[rgba(235,235,245,0.6)]">
          {item ? `Folio — ${item.fileName}` : 'Folio'}
        </span>
      </div>
      <div className="h-px bg-white/[0.06]" />
    </div>
  )
}
