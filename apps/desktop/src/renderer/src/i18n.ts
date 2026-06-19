import type { SortMode } from '@folio/shared-types'
import { type AppLanguage, useSettingsStore } from './stores/settingsStore'

type Vars = Record<string, string | number>

const en = {
  'toolbar.showSidebar': 'Show sidebar',
  'toolbar.hideSidebar': 'Hide sidebar',
  'toolbar.openFolder': 'Open Folder (⌘⇧O)',
  'toolbar.openFile': 'Open File (⌘O)',
  'toolbar.mode.single': 'Single (⌘1)',
  'toolbar.mode.dual': 'Dual (⌘2)',
  'toolbar.mode.triple': 'Triple (⌘3)',
  'toolbar.mode.quad': 'Quad (⌘4)',
  'toolbar.swapLayout': 'Swap layout',
  'toolbar.previousGroup': 'Previous group (←)',
  'toolbar.nextGroup': 'Next group (→)',
  'toolbar.random': 'Random (Shift+R)',
  'toolbar.syncZoom': 'Sync zoom (S)',
  'toolbar.loopBrowsing': 'Loop browsing',
  'toolbar.zoomOut': 'Zoom Out (−)',
  'toolbar.fitOriginal': 'Fit / Original (Space)',
  'toolbar.fit': 'Fit',
  'toolbar.zoomIn': 'Zoom In (+)',
  'toolbar.rotate': 'Rotate (R)',
  'toolbar.resetOrientation': 'Reset orientation',
  'toolbar.sortOrder': 'Sort order',
  'toolbar.fullscreen': 'Fullscreen (F11)',
  'toolbar.settings': 'Settings',
  'toolbar.backToViewer': 'Back to viewer',

  'sort.name_asc': 'Name (A-Z)',
  'sort.name_desc': 'Name (Z-A)',
  'sort.modified_asc': 'Modified (oldest)',
  'sort.modified_desc': 'Modified (newest)',
  'sort.created_asc': 'Created (oldest)',
  'sort.created_desc': 'Created (newest)',
  'sort.size_asc': 'Size (smallest)',
  'sort.size_desc': 'Size (largest)',
  'sort.format_asc': 'Format',

  'empty.title': 'No images open',
  'empty.subtitle': 'Open a folder or drag images here to start browsing.',
  'empty.openFolder': 'Open Folder',
  'empty.openFile': 'Open File',
  'empty.recentFolders': 'Recent folders',
  'empty.removeRecentFolder': 'Remove from recent folders',
  'empty.clearRecentFolders': 'Clear history',
  'empty.clearRecentFoldersTitle': 'Clear recent folder history?',
  'empty.clearRecentFoldersDetail':
    'This only removes the recent-folder history. Your folders and images will not be deleted.',
  'empty.clearRecentFoldersConfirm': 'Clear history',

  'queue.title': 'Queue',
  'queue.images': '{count} images',

  'canvas.previewUnavailable': '{format} preview not available yet',
  'canvas.previewUnavailableDetail':
    '{fileName} - rendering for this format arrives with the sharp preview pipeline (M6/M7).',
  'canvas.failedToDecode': 'Failed to decode {fileName}',
  'canvas.previous': 'Previous (←)',
  'canvas.next': 'Next (→)',
  'canvas.backToGrid': 'Back to grid (Esc)',

  'multi.noMoreImages': 'No more images',
  'multi.previewUnavailable': '{format} preview not available yet',
  'multi.failedToDecode': 'Failed to decode',

  'status.mode.single': 'Single',
  'status.mode.dual': 'Dual',
  'status.mode.triple': 'Triple',
  'status.mode.quad': 'Quad',
  'status.sync': 'Sync',
  'status.fit': 'Fit',
  'status.noFolderOpen': 'No folder open',

  'context.copyImage': 'Copy Image',
  'context.copyPath': 'Copy Path',
  'context.revealInFinder': 'Reveal in Finder',
  'context.revealInExplorer': 'Show in File Explorer',
  'context.revealInFolder': 'Show in folder',
  'context.moveToTrash': 'Move to Trash',

  'trash.title': 'Move image to Trash?',
  'trash.detail': 'The file will be removed from the queue and moved to the system Trash.',
  'trash.skipUntilRestart': "Don't ask again until Folio restarts",
  'trash.cancel': 'Cancel',
  'trash.confirm': 'Move to Trash',

  'toast.noSupportedImages': 'No supported images found',
  'toast.movedToTrash': 'Moved to Trash',
  'toast.trashFailed': 'Could not move to Trash',
  'toast.pathCopied': 'Path copied',
  'toast.imageCopied': 'Image copied',
  'toast.imageCopyUnsupported': "This format can't be copied yet",

  'settings.title': 'Settings',
  'settings.subtitle': 'Tune Folio for the way you browse.',
  'settings.languageSection': 'Language',
  'settings.languageLabel': 'Interface language',
  'settings.languageHelp': 'Language changes apply immediately and are saved on this device.',
  'settings.language.zh-CN': 'Simplified Chinese',
  'settings.language.en': 'English',
} as const

const zhCN: Record<keyof typeof en, string> = {
  'toolbar.showSidebar': '显示侧边栏',
  'toolbar.hideSidebar': '隐藏侧边栏',
  'toolbar.openFolder': '打开文件夹 (⌘⇧O)',
  'toolbar.openFile': '打开文件 (⌘O)',
  'toolbar.mode.single': '单图 (⌘1)',
  'toolbar.mode.dual': '双图 (⌘2)',
  'toolbar.mode.triple': '三图 (⌘3)',
  'toolbar.mode.quad': '四宫格 (⌘4)',
  'toolbar.swapLayout': '切换布局',
  'toolbar.previousGroup': '上一组 (←)',
  'toolbar.nextGroup': '下一组 (→)',
  'toolbar.random': '随机 (Shift+R)',
  'toolbar.syncZoom': '同步缩放 (S)',
  'toolbar.loopBrowsing': '循环浏览',
  'toolbar.zoomOut': '缩小 (−)',
  'toolbar.fitOriginal': '适应 / 原始尺寸 (Space)',
  'toolbar.fit': '适应',
  'toolbar.zoomIn': '放大 (+)',
  'toolbar.rotate': '旋转 (R)',
  'toolbar.resetOrientation': '重置方向',
  'toolbar.sortOrder': '排序方式',
  'toolbar.fullscreen': '全屏 (F11)',
  'toolbar.settings': '设置',
  'toolbar.backToViewer': '返回浏览',

  'sort.name_asc': '名称 (A-Z)',
  'sort.name_desc': '名称 (Z-A)',
  'sort.modified_asc': '修改时间 (最早)',
  'sort.modified_desc': '修改时间 (最新)',
  'sort.created_asc': '创建时间 (最早)',
  'sort.created_desc': '创建时间 (最新)',
  'sort.size_asc': '大小 (最小)',
  'sort.size_desc': '大小 (最大)',
  'sort.format_asc': '格式',

  'empty.title': '未打开图片',
  'empty.subtitle': '打开文件夹，或将图片拖到这里开始浏览。',
  'empty.openFolder': '打开文件夹',
  'empty.openFile': '打开文件',
  'empty.recentFolders': '最近文件夹',
  'empty.removeRecentFolder': '从最近文件夹中移除',
  'empty.clearRecentFolders': '清除历史',
  'empty.clearRecentFoldersTitle': '清除最近文件夹历史？',
  'empty.clearRecentFoldersDetail': '这只会清除最近文件夹记录，不会删除真实文件夹或图片。',
  'empty.clearRecentFoldersConfirm': '清除历史',

  'queue.title': '队列',
  'queue.images': '{count} 张图片',

  'canvas.previewUnavailable': '暂不支持预览 {format}',
  'canvas.previewUnavailableDetail':
    '{fileName} - 该格式的渲染会随 sharp 预览管线一起到来 (M6/M7)。',
  'canvas.failedToDecode': '无法解码 {fileName}',
  'canvas.previous': '上一张 (←)',
  'canvas.next': '下一张 (→)',
  'canvas.backToGrid': '返回网格 (Esc)',

  'multi.noMoreImages': '没有更多图片',
  'multi.previewUnavailable': '暂不支持预览 {format}',
  'multi.failedToDecode': '无法解码',

  'status.mode.single': '单图',
  'status.mode.dual': '双图',
  'status.mode.triple': '三图',
  'status.mode.quad': '四宫格',
  'status.sync': '同步',
  'status.fit': '适应',
  'status.noFolderOpen': '未打开文件夹',

  'context.copyImage': '复制图片',
  'context.copyPath': '复制路径',
  'context.revealInFinder': '在访达中显示',
  'context.revealInExplorer': '在资源管理器中显示',
  'context.revealInFolder': '在文件夹中显示',
  'context.moveToTrash': '移到废纸篓',

  'trash.title': '将图片移到废纸篓？',
  'trash.detail': '该文件会从队列中移除，并移动到系统废纸篓。',
  'trash.skipUntilRestart': 'Folio 重启前不再提示',
  'trash.cancel': '取消',
  'trash.confirm': '移到废纸篓',

  'toast.noSupportedImages': '未找到支持的图片',
  'toast.movedToTrash': '已移到废纸篓',
  'toast.trashFailed': '无法移到废纸篓',
  'toast.pathCopied': '路径已复制',
  'toast.imageCopied': '图片已复制',
  'toast.imageCopyUnsupported': '该格式暂不能复制',

  'settings.title': '设置',
  'settings.subtitle': '调整 Folio 的浏览体验。',
  'settings.languageSection': '语言',
  'settings.languageLabel': '界面语言',
  'settings.languageHelp': '语言会立即生效，并保存在当前设备上。',
  'settings.language.zh-CN': '简体中文',
  'settings.language.en': '英文',
}

export type I18nKey = keyof typeof en

type Dictionary = Record<I18nKey, string>

const dictionaries: Record<AppLanguage, Dictionary> = {
  en,
  'zh-CN': zhCN,
}

export const SORT_LABEL_KEYS: Record<SortMode, I18nKey> = {
  name_asc: 'sort.name_asc',
  name_desc: 'sort.name_desc',
  modified_asc: 'sort.modified_asc',
  modified_desc: 'sort.modified_desc',
  created_asc: 'sort.created_asc',
  created_desc: 'sort.created_desc',
  size_asc: 'sort.size_asc',
  size_desc: 'sort.size_desc',
  format_asc: 'sort.format_asc',
}

function interpolate(text: string, vars?: Vars): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (match, key) =>
    vars[key] === undefined ? match : String(vars[key]),
  )
}

export function translate(language: AppLanguage, key: I18nKey, vars?: Vars): string {
  return interpolate(dictionaries[language][key] ?? en[key], vars)
}

export function tNow(key: I18nKey, vars?: Vars): string {
  return translate(useSettingsStore.getState().language, key, vars)
}

export function useT(): (key: I18nKey, vars?: Vars) => string {
  const language = useSettingsStore((s) => s.language)
  return (key, vars) => translate(language, key, vars)
}
