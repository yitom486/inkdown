import { basename } from 'path'
import type { BrowserWindow } from 'electron'
import { APP_TITLE } from '@shared/constants/app'

export function formatWindowTitle(
  filePath?: string,
  isDirty = false,
  appTitle = APP_TITLE,
): string {
  const dirtyMark = isDirty ? ' •' : ''
  if (filePath) {
    return `${basename(filePath)}${dirtyMark} — ${appTitle}`
  }
  return `未命名${dirtyMark} — ${appTitle}`
}

export function applyWindowTitle(
  window: BrowserWindow,
  filePath?: string,
  isDirty = false,
): void {
  window.setTitle(formatWindowTitle(filePath, isDirty))
}
