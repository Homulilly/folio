import { useT } from '../i18n'
import { useAutoModeStore } from '../stores/autoModeStore'
import { ZapIcon } from './icons'

const baseName = (p: string): string => p.replaceAll('\\', '/').split('/').pop() ?? p

/** Persistent status strip while session auto-mode is on (PRD §6.6 防误操作 — clear indicator +
 * one-click off). Rendered under the toolbar, amber so it reads as an active background action. */
export function AutoModeStrip(): React.JSX.Element | null {
  const t = useT()
  const active = useAutoModeStore((s) => s.active)
  const presetId = useAutoModeStore((s) => s.presetId)
  const directory = useAutoModeStore((s) => s.directory)
  const disable = useAutoModeStore((s) => s.disable)

  if (!active) return null

  return (
    <div className="flex h-7 flex-none items-center justify-between gap-3 border-b border-[#FF9F0A]/25 bg-[#FF9F0A]/10 px-3 text-[12px]">
      <span className="flex min-w-0 items-center gap-2 text-[#FFB340]">
        <ZapIcon size={13} />
        <span className="flex-none font-medium">
          {t('auto.stripLabel', { preset: presetId ? t(`erase.preset.${presetId}`) : '' })}
        </span>
        {directory && (
          <span className="truncate font-mono text-[rgba(235,235,245,0.5)]">
            {baseName(directory)}
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={disable}
        className="flex-none rounded-md px-2 py-0.5 font-medium text-[#FFB340] transition-colors hover:bg-[#FF9F0A]/15"
      >
        {t('auto.turnOff')}
      </button>
    </div>
  )
}
