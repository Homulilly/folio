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

// Rotate clockwise — a near-full circular arrow.
export const RotateIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </>,
    p,
  )

// Reset orientation — mirrored (counter-clockwise) circular arrow back to upright.
export const RotateResetIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M3 12a9 9 0 1 0 9-9c-2.52 0-4.93 1-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </>,
    p,
  )

export const FullscreenIcon = (p: IconProps) =>
  svg(
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" />,
    p,
  )

export const SettingsIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8.92 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.45.3 1.04 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </>,
    p,
    1.5,
  )

// Arrows pointing inward — collapse the expanded focus view back to the grid.
export const ShrinkIcon = (p: IconProps) =>
  svg(
    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3m8 0v-3a2 2 0 0 1 2-2h3" />,
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

export const CloseIcon = (p: IconProps) => svg(<path d="M18 6 6 18M6 6l12 12" />, p)

export const CheckIcon = (p: IconProps) => svg(<path d="M20 6 9 17l-5-5" />, p, 2.4)

export const ShieldIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </>,
    p,
  )

export const SearchIcon = (p: IconProps) =>
  svg(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
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

// Toggle the left side rail (panel with a left column).
export const SidebarIcon = (p: IconProps) =>
  svg(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </>,
    p,
    1.6,
  )

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

export const PauseIcon = (p: IconProps) =>
  svg(
    <>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </>,
    p,
  )

export const PlayIcon = (p: IconProps) => svg(<path d="M7 4v16l13-8z" />, p)

export const DownloadIcon = (p: IconProps) =>
  svg(<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />, p)

export const TasksIcon = (p: IconProps) =>
  svg(<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />, p)

export const ZapIcon = (p: IconProps) => svg(<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />, p)

// Circular refresh arrows — re-scan the open folder.
export const RefreshIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v5h-5" />
    </>,
    p,
    1.7,
  )

// Folder with a branch — toggle the folder browser.
export const FolderTreeIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M3 6a1 1 0 0 1 1-1h4l1.5 2H20a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Z" />
      <path d="M8 13v3a2 2 0 0 0 2 2h2" />
      <rect x="12" y="16" width="8" height="5" rx="1" />
    </>,
    p,
    1.6,
  )

// Up-and-left arrow — step out to the parent folder (the ".." row).
export const CornerUpLeftIcon = (p: IconProps) =>
  svg(<path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 5 5v6" />, p, 1.7)

// Descending bars — the sort-order menu trigger.
export const SortIcon = (p: IconProps) => svg(<path d="M4 6h13M4 12h9M4 18h5" />, p, 1.8)

// Floppy disk — save to a target folder.
export const SaveIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M7 3v5h8V3M8 15h8" />
    </>,
    p,
    1.7,
  )

// Two opposing arrows — format conversion.
export const ConvertIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
      <rect x="2.5" y="3" width="6" height="6" rx="1.2" />
      <rect x="15.5" y="15" width="6" height="6" rx="1.2" />
    </>,
    p,
    1.6,
  )

// Arrow into a tray — quick save (one-click send to the remembered folder).
export const QuickSaveIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M12 3v9m0 0 3.5-3.5M12 12 8.5 8.5" />
      <path d="M4 14v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>,
    p,
    1.7,
  )

// Pencil over a baseline — batch rename.
export const RenameIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </>,
    p,
    1.7,
  )
