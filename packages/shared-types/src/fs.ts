// Directory-browsing types — used by the queue rail's folder browser and "load next folder".

/** A subdirectory surfaced while browsing, with cheap (extension-only) child counts for hinting. */
export interface DirEntry {
  name: string
  path: string
  /** Number of supported images directly inside (by extension; not magic-byte verified). */
  imageCount: number
  /** Number of (non-hidden) subdirectories — drives the "drill in" chevron. */
  subdirCount: number
}

/** A listing of one directory's immediate subdirectories, for the folder browser. */
export interface DirListing {
  /** The listed directory. */
  path: string
  /** Its parent, or null at the filesystem root (drives the ".." row). */
  parent: string | null
  /** Basename of {@link path}, for the breadcrumb. */
  name: string
  /** Immediate subdirectories, sorted by name (hidden dot-folders excluded). */
  directories: DirEntry[]
}
