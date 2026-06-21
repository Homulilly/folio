import type { ConflictPolicy } from '@folio/shared-types'
import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { useMultiViewStore } from '../stores/multiViewStore'
import {
  choiceFromNaming,
  namingFromChoice,
  type SaveNamingChoice,
  useSaveStore,
} from '../stores/saveStore'
import type { AppLanguage } from '../stores/settingsStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useUiStore } from '../stores/uiStore'
import { ChevronDown, CloseIcon, FolderIcon, SettingsIcon } from './icons'

const LANGUAGES: readonly AppLanguage[] = ['zh-CN', 'en']
const LANGUAGE_NAMES: Record<AppLanguage, string> = {
  'zh-CN': '简体中文',
  en: 'English',
}

/** A settings section: title + help on the left, controls on the right (matches the language row). */
function Section({
  title,
  help,
  children,
}: {
  title: string
  help: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="grid gap-5 border-t border-white/[0.06] py-5 md:grid-cols-[180px_1fr]">
      <div>
        <h2 className="text-[13px] font-semibold text-[rgba(235,235,245,0.9)]">{title}</h2>
        <p className="mt-1 text-[12px] leading-5 text-[rgba(235,235,245,0.42)]">{help}</p>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

/** macOS-style switch with a label + help text on the left. */
function SwitchRow({
  label,
  help,
  on,
  onToggle,
}: {
  label: string
  help: string
  on: boolean
  onToggle: () => void
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[13px] text-[rgba(235,235,245,0.86)]">{label}</div>
        <div className="mt-0.5 text-[12px] leading-5 text-[rgba(235,235,245,0.42)]">{help}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onToggle}
        className={`relative h-[22px] w-[38px] flex-none rounded-full transition-colors ${
          on ? 'bg-[#0A84FF]' : 'bg-white/[0.16]'
        }`}
      >
        <span
          className={`absolute left-[2px] top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${
            on ? 'translate-x-[16px]' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

/** A megabyte cache-size input (clamped on commit). */
function CacheSizeRow({
  label,
  mb,
  onCommit,
}: {
  label: string
  mb: number
  onCommit: (mb: number) => void
}): React.JSX.Element {
  const [text, setText] = useState(String(mb))
  useEffect(() => setText(String(mb)), [mb])
  const commit = (): void => {
    const n = Math.round(Number(text))
    if (Number.isFinite(n) && n >= 64) onCommit(n)
    else setText(String(mb))
  }
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-[13px] text-[rgba(235,235,245,0.86)]">{label}</div>
      <div className="flex flex-none items-center gap-2">
        <input
          type="number"
          min={64}
          step={64}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="w-24 rounded-lg bg-[#1C1C1E] px-3 py-1.5 text-right font-mono text-[13px] text-white outline-none ring-1 ring-white/[0.08] focus:ring-[#0A84FF]/50"
        />
        <span className="text-[12px] text-[rgba(235,235,245,0.5)]">MB</span>
      </div>
    </div>
  )
}

/** A label + native dropdown row, styled for the dark settings page. */
function SelectRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (v: T) => void
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-[13px] text-[rgba(235,235,245,0.86)]">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="flex-none rounded-lg bg-[#1C1C1E] px-3 py-1.5 text-[13px] text-white outline-none ring-1 ring-white/[0.08] focus:ring-[#0A84FF]/50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#1C1C1E]">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

const NAMING_CHOICES: readonly SaveNamingChoice[] = ['keep', 'md5', 'sha1', 'sequence', 'template']
const CONFLICT_CHOICES: readonly ConflictPolicy[] = ['number', 'skip', 'overwrite', 'md5_compare']
const folderName = (p: string): string =>
  p.replaceAll('\\', '/').replace(/\/+$/, '').split('/').pop() ?? p

/** Quick-save settings: default naming + conflict policy and the list of target folders. */
function QuickSaveSettings(): React.JSX.Element {
  const t = useT()
  const rule = useSaveStore((s) => s.quickRule)
  const setQuickNaming = useSaveStore((s) => s.setQuickNaming)
  const setQuickConflict = useSaveStore((s) => s.setQuickConflict)
  const addQuickTarget = useSaveStore((s) => s.addQuickTarget)
  const removeQuickTarget = useSaveStore((s) => s.removeQuickTarget)

  const naming = rule?.naming ?? { kind: 'keep' as const }
  const conflict = rule?.conflict ?? 'number'
  const targets = rule?.targetDirs ?? []
  const { choice, template } = choiceFromNaming(naming)
  const [tpl, setTpl] = useState(template)
  useEffect(() => setTpl(template), [template])

  const onChoice = (c: SaveNamingChoice): void =>
    setQuickNaming(namingFromChoice(c, tpl || '{name}_{nr:001}.{ext}'))
  const commitTpl = (): void => {
    if (tpl.trim()) setQuickNaming({ kind: 'template', template: tpl })
  }
  const addFolder = async (): Promise<void> => {
    const dir = await window.gv.file.chooseDirectory()
    if (dir) addQuickTarget(dir)
  }

  return (
    <Section title={t('settings.quickSaveSection')} help={t('settings.quickSaveHelp')}>
      <SelectRow
        label={t('settings.quickNamingLabel')}
        value={choice}
        options={NAMING_CHOICES.map((c) => ({ value: c, label: t(`save.naming.${c}`) }))}
        onChange={onChoice}
      />
      {choice === 'template' && (
        <input
          value={tpl}
          onChange={(e) => setTpl(e.target.value)}
          onBlur={commitTpl}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          placeholder={t('settings.quickTemplatePlaceholder')}
          className="w-full rounded-lg bg-[#1C1C1E] px-3 py-1.5 font-mono text-[12px] text-white outline-none ring-1 ring-white/[0.08] focus:ring-[#0A84FF]/50 placeholder:font-sans placeholder:text-[rgba(235,235,245,0.3)]"
        />
      )}
      <SelectRow
        label={t('settings.quickConflictLabel')}
        value={conflict}
        options={CONFLICT_CHOICES.map((c) => ({ value: c, label: t(`save.conflict.${c}`) }))}
        onChange={setQuickConflict}
      />

      <div className="flex flex-col gap-2">
        <div className="text-[13px] text-[rgba(235,235,245,0.86)]">
          {t('settings.quickTargetsLabel')}
        </div>
        {targets.length === 0 ? (
          <p className="text-[12px] leading-5 text-[rgba(235,235,245,0.42)]">
            {t('settings.quickNoTargets')}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {targets.map((dir) => (
              <div
                key={dir}
                className="flex items-center gap-2.5 rounded-lg bg-white/[0.04] px-3 py-2"
              >
                <FolderIcon size={15} className="flex-none text-[rgba(235,235,245,0.5)]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-[rgba(235,235,245,0.86)]">
                    {folderName(dir)}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-[rgba(235,235,245,0.4)]">
                    {dir}
                  </span>
                </span>
                <button
                  type="button"
                  title={t('settings.quickRemoveTarget')}
                  aria-label={t('settings.quickRemoveTarget')}
                  onClick={() => removeQuickTarget(dir)}
                  className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-[rgba(235,235,245,0.5)] transition-colors hover:bg-white/[0.08] hover:text-[#FF453A]"
                >
                  <CloseIcon size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => void addFolder()}
          className="w-fit rounded-lg bg-white/[0.06] px-3 py-1.5 text-[12px] font-medium text-[rgba(235,235,245,0.86)] transition-colors hover:bg-white/[0.1]"
        >
          {t('settings.quickAddFolder')}
        </button>
      </div>
    </Section>
  )
}

export function SettingsPage(): React.JSX.Element {
  const t = useT()
  const language = useSettingsStore((s) => s.language)
  const setLanguage = useSettingsStore((s) => s.setLanguage)
  const confirmDeleteToTrash = useSettingsStore((s) => s.confirmDeleteToTrash)
  const setConfirmDeleteToTrash = useSettingsStore((s) => s.setConfirmDeleteToTrash)
  const thumbnailCacheSizeMB = useSettingsStore((s) => s.thumbnailCacheSizeMB)
  const previewCacheSizeMB = useSettingsStore((s) => s.previewCacheSizeMB)
  const setCacheSizeMB = useSettingsStore((s) => s.setCacheSizeMB)
  const loopEnabled = useMultiViewStore((s) => s.loopEnabled)
  const toggleLoop = useMultiViewStore((s) => s.toggleLoop)
  const syncZoom = useMultiViewStore((s) => s.syncZoom)
  const toggleSync = useMultiViewStore((s) => s.toggleSync)
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

          <Section title={t('settings.browsingSection')} help={t('settings.browsingHelp')}>
            <SwitchRow
              label={t('settings.loopLabel')}
              help={t('settings.loopHelp')}
              on={loopEnabled}
              onToggle={toggleLoop}
            />
            <SwitchRow
              label={t('settings.syncZoomLabel')}
              help={t('settings.syncZoomHelp')}
              on={syncZoom}
              onToggle={toggleSync}
            />
          </Section>

          <Section title={t('settings.safetySection')} help={t('settings.safetyHelp')}>
            <SwitchRow
              label={t('settings.confirmTrashLabel')}
              help={t('settings.confirmTrashHelp')}
              on={confirmDeleteToTrash}
              onToggle={() => setConfirmDeleteToTrash(!confirmDeleteToTrash)}
            />
          </Section>

          <Section title={t('settings.cacheSection')} help={t('settings.cacheHelp')}>
            <CacheSizeRow
              label={t('settings.thumbnailCacheLabel')}
              mb={thumbnailCacheSizeMB}
              onCommit={(mb) => setCacheSizeMB('thumbnail', mb)}
            />
            <CacheSizeRow
              label={t('settings.previewCacheLabel')}
              mb={previewCacheSizeMB}
              onCommit={(mb) => setCacheSizeMB('preview', mb)}
            />
          </Section>

          <QuickSaveSettings />

          <Section title={t('settings.diagnosticsSection')} help={t('settings.diagnosticsHelp')}>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[13px] text-[rgba(235,235,245,0.86)]">
                  {t('settings.openLogsLabel')}
                </div>
                <div className="mt-0.5 text-[12px] leading-5 text-[rgba(235,235,245,0.42)]">
                  {t('settings.openLogsHelp')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void window.gv.system.openLogs()}
                className="flex-none rounded-lg bg-white/[0.06] px-3 py-1.5 text-[12px] font-medium text-[rgba(235,235,245,0.86)] transition-colors hover:bg-white/[0.1]"
              >
                {t('settings.openLogsButton')}
              </button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}
