import { useToastStore } from '../stores/toastStore'

const TONE_DOT: Record<string, string> = {
  info: '#0A84FF',
  success: '#32D7A0',
  error: '#FF453A',
}

export function Toast(): React.JSX.Element | null {
  const message = useToastStore((s) => s.message)
  const tone = useToastStore((s) => s.tone)
  if (!message) return null

  return (
    <div className="-translate-x-1/2 fixed bottom-12 left-1/2 z-50 flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-[#2C2C2E] px-4 py-2.5 shadow-2xl">
      <span
        className="h-2 w-2 flex-none rounded-full"
        style={{ background: TONE_DOT[tone] ?? TONE_DOT.info }}
      />
      <span className="text-sm font-medium text-white">{message}</span>
    </div>
  )
}
