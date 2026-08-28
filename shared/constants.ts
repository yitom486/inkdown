/** 编辑器支持的 Markdown 相关扩展名（不含点） */
export const MARKDOWN_EXTENSIONS = ['md', 'markdown', 'txt'] as const

/** 只读阅读器支持的扩展名（不含点） */
export const READER_EXTENSIONS = ['pdf', 'epub'] as const

/** 带点号的扩展名集合，用于工作区扫描 */
export const MARKDOWN_EXTENSION_SET = new Set<string>(
  MARKDOWN_EXTENSIONS.map((ext) => `.${ext}`),
)

export const READER_EXTENSION_SET = new Set<string>(
  READER_EXTENSIONS.map((ext) => `.${ext}`),
)

export const ALL_DOCUMENT_EXTENSIONS = [...MARKDOWN_EXTENSIONS, ...READER_EXTENSIONS] as const

/** 工作区扫描支持的扩展名展示（带点） */
export const SUPPORTED_WORKSPACE_EXTENSION_LABEL = ALL_DOCUMENT_EXTENSIONS.map(
  (ext) => `.${ext}`,
).join(' / ')

/** 工作区目录树最大递归深度 */
export const WORKSPACE_MAX_DEPTH = 6

/** 工作区扫描时跳过的目录名 */
export const WORKSPACE_IGNORED_DIR_NAMES = new Set(['node_modules'])

export const APP_TITLE = '轻量阅读器'

export const DEFAULT_SAVE_FILENAME = 'untitled.md'

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
  { name: 'All Files', extensions: ['*'] },
]

export const HTML_DIALOG_FILTERS = [{ name: 'HTML', extensions: ['html', 'htm'] }]

export const PDF_DIALOG_FILTERS = [{ name: 'PDF', extensions: ['pdf'] }]

/** 粘贴图片默认保存到 Markdown 文件同级的 assets 目录 */
export const PASTED_IMAGE_ASSETS_DIR = 'assets'
