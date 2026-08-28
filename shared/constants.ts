/** 编辑器支持的 Markdown 相关扩展名（不含点） */
export const MARKDOWN_EXTENSIONS = ['md', 'markdown', 'txt'] as const

/** 带点号的扩展名集合，用于工作区扫描 */
export const MARKDOWN_EXTENSION_SET = new Set<string>(
  MARKDOWN_EXTENSIONS.map((ext) => `.${ext}`),
)

/** 工作区目录树最大递归深度 */
export const WORKSPACE_MAX_DEPTH = 6

/** 工作区扫描时跳过的目录名 */
export const WORKSPACE_IGNORED_DIR_NAMES = new Set(['node_modules'])

export const APP_TITLE = 'Markdown Editor'

export const DEFAULT_SAVE_FILENAME = 'untitled.md'

/** Electron 文件对话框过滤器 */
export const MARKDOWN_DIALOG_FILTERS = [
  { name: 'Markdown', extensions: [...MARKDOWN_EXTENSIONS] },
  { name: 'All Files', extensions: ['*'] },
]
