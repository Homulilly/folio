import type { I18nKey } from '../i18n'

function platform(): string {
  return navigator.platform.toLowerCase()
}

export function revealLabelKey(): I18nKey {
  const p = platform()
  if (p.includes('mac')) return 'context.revealInFinder'
  if (p.includes('win')) return 'context.revealInExplorer'
  return 'context.revealInFolder'
}

export function trashTextKeys(): {
  context: I18nKey
  title: I18nKey
  detail: I18nKey
  skip: I18nKey
  confirm: I18nKey
  success: I18nKey
  failed: I18nKey
} {
  const p = platform()
  if (p.includes('win')) {
    return {
      context: 'context.moveToRecycleBin',
      title: 'trash.title.recycleBin',
      detail: 'trash.detail.recycleBin',
      skip: 'trash.skipUntilRestart.recycleBin',
      confirm: 'trash.confirm.recycleBin',
      success: 'toast.movedToRecycleBin',
      failed: 'toast.recycleBinFailed',
    }
  }

  return {
    context: 'context.moveToTrash',
    title: 'trash.title.trash',
    detail: 'trash.detail.trash',
    skip: 'trash.skipUntilRestart.trash',
    confirm: 'trash.confirm.trash',
    success: 'toast.movedToTrash',
    failed: 'toast.trashFailed',
  }
}
