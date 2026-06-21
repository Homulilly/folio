// Exif / metadata types — read-only viewing (M3). Field-level erasure types arrive with M4.
// The main process reads tags via exiftool-vendored and normalises them into these shapes;
// all values are pre-stringified for display so the renderer never deals with raw tag unions.

/** A single metadata field within a group. */
export interface ExifEntry {
  /** Field name without its group prefix, e.g. `Make`, `GPSLatitude`, `ExposureTime`. */
  key: string
  /** Display value, already stringified by the main process (arrays joined, numbers rendered). */
  value: string
}

/** A group of fields, keyed by ExifTool's family-0 group name. */
export interface ExifGroup {
  /** Family-0 group, e.g. `EXIF` · `GPS` · `XMP` · `IPTC` · `ICC_Profile` · `File` · `Composite`. */
  group: string
  entries: ExifEntry[]
}

/**
 * IFD1 (thumbnail IFD) copies of description / artist / copyright — tags 0x010E / 0x013B / 0x8298.
 * Read separately (group-qualified) because when IFD0 holds an empty copy, ExifTool suppresses the
 * IFD1 one in the main `-G0` dump. Used only as a summary fallback when the primary value is empty.
 */
export interface ExifIfd1Fallback {
  description?: string
  artist?: string
  copyright?: string
}

/** Full metadata for one image, grouped. Empty `groups` means a successful read with no tags. */
export interface ExifMetadata {
  filePath: string
  groups: ExifGroup[]
  /** Present only when at least one IFD1 fallback value was found; omitted otherwise. */
  ifd1?: ExifIfd1Fallback
}
