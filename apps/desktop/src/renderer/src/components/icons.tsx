interface IconProps {
  size?: number
  className?: string
}

function svg(path: React.ReactNode, props: IconProps, width = 1.8) {
  return (
    <svg
      width={props.size ?? 18}
      height={props.size ?? 18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden="true"
    >
      {path}
    </svg>
  )
}

export const FolderIcon = (p: IconProps) =>
  svg(
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />,
    p,
  )

export const ImageIcon = (p: IconProps) =>
  svg(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" />
    </>,
    p,
  )

export const ChevronLeft = (p: IconProps) => svg(<path d="m15 18-6-6 6-6" />, p, 1.9)
export const ChevronRight = (p: IconProps) => svg(<path d="m9 18 6-6-6-6" />, p, 1.9)
export const ChevronDown = (p: IconProps) => svg(<path d="m6 9 6 6 6-6" />, p, 2)

export const ZoomIn = (p: IconProps) =>
  svg(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3M11 8v6M8 11h6" />
    </>,
    p,
  )

export const ZoomOut = (p: IconProps) =>
  svg(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3M8 11h6" />
    </>,
    p,
  )

export const RotateIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    </>,
    p,
  )

export const FullscreenIcon = (p: IconProps) =>
  svg(
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" />,
    p,
  )

export const InfoIcon = (p: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>,
    p,
  )

export const TrashIcon = (p: IconProps) =>
  svg(
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />,
    p,
  )

export const CopyIcon = (p: IconProps) =>
  svg(
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>,
    p,
  )

export const ShuffleIcon = (p: IconProps) =>
  svg(<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />, p)

// --- multi-view layout glyphs (outlined panes) ---
export const LayoutSingle = (p: IconProps) =>
  svg(<rect x="4" y="5" width="16" height="14" rx="1.6" />, p, 1.6)

export const LayoutDual = (p: IconProps) =>
  svg(
    <>
      <rect x="3.5" y="5" width="7.5" height="14" rx="1.4" />
      <rect x="13" y="5" width="7.5" height="14" rx="1.4" />
    </>,
    p,
    1.6,
  )

export const LayoutTriple = (p: IconProps) =>
  svg(
    <>
      <rect x="3.5" y="5" width="8.5" height="14" rx="1.4" />
      <rect x="14" y="5" width="6.5" height="6.3" rx="1.4" />
      <rect x="14" y="12.7" width="6.5" height="6.3" rx="1.4" />
    </>,
    p,
    1.6,
  )

export const LayoutQuad = (p: IconProps) =>
  svg(
    <>
      <rect x="3.5" y="5" width="7.5" height="6.3" rx="1.3" />
      <rect x="13" y="5" width="7.5" height="6.3" rx="1.3" />
      <rect x="3.5" y="12.7" width="7.5" height="6.3" rx="1.3" />
      <rect x="13" y="12.7" width="7.5" height="6.3" rx="1.3" />
    </>,
    p,
    1.6,
  )

export const SyncIcon = (p: IconProps) => svg(<path d="M4 8h13l-3-3M20 16H7l3 3" />, p)

export const LoopIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </>,
    p,
  )

export const LayoutSwap = (p: IconProps) =>
  svg(<path d="M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16" />, p)
