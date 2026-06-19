import { useQueueStore } from '../stores/queueStore'

export function TitleBar(): React.JSX.Element {
  const item = useQueueStore((s) => s.items[s.currentIndex])

  return (
    <div className="flex h-[38px] flex-none items-center justify-center border-b border-white/[0.06] bg-[#1C1C1E] [-webkit-app-region:drag]">
      <span className="truncate px-4 text-[13px] font-semibold text-[rgba(235,235,245,0.6)]">
        {item ? `GalleryViewer — ${item.fileName}` : 'GalleryViewer'}
      </span>
    </div>
  )
}
