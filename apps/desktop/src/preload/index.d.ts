import type { GalleryViewerApi } from '@galleryviewer/shared-types'

declare global {
  interface Window {
    gv: GalleryViewerApi
  }
}
