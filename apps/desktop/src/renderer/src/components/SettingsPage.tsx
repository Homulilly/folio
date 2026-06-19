import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import type { AppLanguage } from '../stores/settingsStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useUiStore } from '../stores/uiStore'
import { ChevronDown, SettingsIcon } from './icons'

const LANGUAGES: readonly AppLanguage[] = ['zh-CN', 'en']
const LANGUAGE_NAMES: Record<AppLanguage, string> = {
  'zh-CN': '简体中文',
  en: 'English',
}

export function SettingsPage(): React.JSX.Element {
  const t = useT()
  const language = useSettingsStore((s) => s.language)
  const setLanguage = useSettingsStore((s) => s.setLanguage)
  const showViewer = useUiStore((s) => s.showViewer)
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)
  const languageMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!languageMenuOpen) return
    const closeOnOutsidePointer = (e: PointerEvent): void => {
      const menu = languageMenuRef.current
      if (menu && !menu.contains(e.target as Node)) setLanguageMenuOpen(false)
    }
    const closeOnEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setLanguageMenuOpen(false)
    }
    window.addEventListener('pointerdown', closeOnOutsidePointer)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsidePointer)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [languageMenuOpen])

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#0E0E0F]">
      <div className="mx-auto flex w-full max-w-3xl flex-col px-6 py-7">
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-[#0A84FF]">
              <SettingsIcon size={18} />
              <span className="text-[12px] font-semibold uppercase tracking-wide">
                {t('settings.title')}
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {t('settings.title')}
            </h1>
            <p className="mt-2 text-[13px] text-[rgba(235,235,245,0.55)]">
              {t('settings.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={showViewer}
            className="flex-none rounded-lg bg-white/[0.06] px-3.5 py-2 text-[13px] font-medium text-[rgba(235,235,245,0.86)] transition-colors hover:bg-white/[0.1]"
          >
            {t('toolbar.backToViewer')}
          </button>
        </div>

        <div className="mt-8 border-y border-white/[0.06]">
          <section className="grid gap-5 py-5 md:grid-cols-[180px_1fr]">
            <div>
              <h2 className="text-[13px] font-semibold text-[rgba(235,235,245,0.9)]">
                {t('settings.languageSection')}
              </h2>
              <p className="mt-1 text-[12px] leading-5 text-[rgba(235,235,245,0.42)]">
                {t('settings.languageHelp')}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="text-[12px] font-medium text-[rgba(235,235,245,0.55)]">
                {t('settings.languageLabel')}
              </div>
              <div ref={languageMenuRef} className="relative w-fit">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={languageMenuOpen}
                  onClick={() => setLanguageMenuOpen((open) => !open)}
                  className="flex min-w-44 items-center justify-between gap-3 rounded-lg bg-[#1C1C1E] px-3 py-2 text-left text-[13px] font-medium text-[rgba(235,235,245,0.86)] ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.06]"
                >
                  <span>{LANGUAGE_NAMES[language]}</span>
                  <ChevronDown
                    size={15}
                    className={`text-[rgba(235,235,245,0.45)] transition-transform ${
                      languageMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {languageMenuOpen && (
                  <div className="absolute left-0 top-full z-20 mt-1.5 min-w-44 overflow-hidden rounded-lg border border-white/[0.08] bg-[#2C2C2E] py-1 shadow-2xl">
                    {LANGUAGES.map((lang) => (
                      <button
                        type="button"
                        key={lang}
                        onClick={() => {
                          setLanguage(lang)
                          setLanguageMenuOpen(false)
                        }}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-[13px] transition-colors ${
                          language === lang
                            ? 'text-[#0A84FF]'
                            : 'text-[rgba(235,235,245,0.86)] hover:bg-[#0A84FF] hover:text-white'
                        }`}
                      >
                        <span>{LANGUAGE_NAMES[lang]}</span>
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            language === lang ? 'bg-[#0A84FF]' : 'bg-transparent'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
