// Small shared building blocks for the modal dialogs (Save / Rename). Mirrors the look of the inputs
// in EraseDialog; kept here so the new dialogs can reuse them without refactoring EraseDialog.

/** A pill-style segmented choice button (scope / mode selectors). */
export function ScopeButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
        active
          ? 'bg-[#0A84FF]/20 text-[#0A84FF]'
          : 'bg-white/[0.05] text-[rgba(235,235,245,0.8)] hover:bg-white/[0.09]'
      }`}
    >
      {label}
    </button>
  )
}

/** A radio row with an optional right-aligned mono hint and a danger tone. */
export function RadioRow({
  checked,
  onSelect,
  label,
  hint,
  tone,
}: {
  checked: boolean
  onSelect: () => void
  label: string
  hint?: string
  tone?: 'danger'
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
        checked ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
      }`}
    >
      <span
        className={`flex h-4 w-4 flex-none items-center justify-center rounded-full border transition-colors ${
          checked
            ? tone === 'danger'
              ? 'border-[#FF453A]'
              : 'border-[#0A84FF]'
            : 'border-white/25'
        }`}
      >
        {checked && (
          <span
            className={`h-2 w-2 rounded-full ${tone === 'danger' ? 'bg-[#FF453A]' : 'bg-[#0A84FF]'}`}
          />
        )}
      </span>
      <span className="text-[13px] text-[rgba(235,235,245,0.9)]">{label}</span>
      {hint && (
        <span className="ml-auto truncate font-mono text-[11px] text-[rgba(235,235,245,0.45)]">
          {hint}
        </span>
      )}
    </button>
  )
}

/** A small labelled text/number field used inside the dialogs. */
export function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as children
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-[rgba(235,235,245,0.5)]">{label}</span>
      {children}
    </label>
  )
}

/** Shared input styling (mono, dark fill). Spread onto an <input>. */
export const inputClass =
  'w-full rounded-lg bg-[#2C2C2E] px-3 py-2 font-mono text-[12px] text-white outline-none placeholder:font-sans placeholder:text-[rgba(235,235,245,0.35)]'
