import { ALL_DOCUMENT_EXTENSIONS, MARKDOWN_EXTENSIONS } from '@shared/constants/extensions'

/** Electron 文件对话框过滤器 */
export const MARKDOWN_DIALOG_FILTERS = [
  { name: 'Markdown', extensions: [...MARKDOWN_EXTENSIONS] },
  { name: 'All Files', extensions: ['*'] },
]

/** 打开文件对话框：Markdown + 电子书 */
export const DOCUMENT_DIALOG_FILTERS = [
  { name: '所有支持格式', extensions: [...ALL_DOCUMENT_EXTENSIONS] },
  { name: 'Markdown', extensions: [...MARKDOWN_EXTENSIONS] },
  { name: 'PDF', extensions: ['pdf'] },
  { name: 'EPUB', extensions: ['epub'] },
  { name: 'MOBI', extensions: ['mobi'] },
  { name: 'All Files', extensions: ['*'] },
]

export const HTML_DIALOG_FILTERS = [{ name: 'HTML', extensions: ['html', 'htm'] }]

export const PDF_DIALOG_FILTERS = [{ name: 'PDF', extensions: ['pdf'] }]

/** 粘贴图片默认保存到 Markdown 文件同级的 assets 目录 */
export const PASTED_IMAGE_ASSETS_DIR = 'assets'
