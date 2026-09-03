/**
 * 主进程 ↔ 渲染进程 IPC 通道名（字符串才是线上协议）。
 * 属性上的 JSDoc 会在 IDE 悬停 `IPC.XXX` 时显示。
 */
export const IPC = {
  /** invoke：读取应用版本号 */
  APP_GET_VERSION: 'app:get-version',
  /** send：请求退出应用 */
  APP_QUIT: 'app:quit',
  /** send：同步当前文档是否未保存（关窗确认用） */
  APP_SET_DIRTY: 'app:set-dirty',
  /** main→renderer：主进程请求关闭窗口，渲染进程可拦截未保存 */
  APP_REQUEST_CLOSE: 'app:request-close',
  /** send：渲染进程回复是否允许关闭（proceed / cancel） */
  APP_CLOSE_DECISION: 'app:close-decision',
  /** send：切换开发者工具 */
  APP_TOGGLE_DEVTOOLS: 'app:toggle-devtools',
  /** invoke：把渲染进程错误写入日志文件 */
  APP_LOG_RENDERER_ERROR: 'app:log-renderer-error',
  /** invoke：返回错误日志文件路径 */
  APP_GET_ERROR_LOG_PATH: 'app:get-error-log-path',
  /** send：开关主进程详细日志 */
  APP_SET_VERBOSE_LOGS: 'app:set-verbose-logs',
  /** send：再开一个主窗口（不恢复工作区） */
  APP_NEW_WINDOW: 'app:new-window',
  /** sendSync（preload）：取窗口启动参数，如 isFreshWindow */
  APP_GET_WINDOW_INIT: 'app:get-window-init',
  /** invoke：用系统默认浏览器打开外链 */
  APP_OPEN_EXTERNAL: 'app:open-external',
  /** invoke：探测本机 Bun 运行时是否可用 */
  BUN_GET_STATUS: 'bun:get-status',
  /** invoke：安装 / 确保 Bun 运行时 */
  BUN_INSTALL: 'bun:install',
  /** invoke：检查应用更新 */
  APP_UPDATE_CHECK: 'app:update-check',
  /** invoke：下载已发现的更新 */
  APP_UPDATE_DOWNLOAD: 'app:update-download',
  /** invoke：安装更新并重启 */
  APP_UPDATE_INSTALL: 'app:update-install',
  /** invoke：读取当前更新状态快照 */
  APP_UPDATE_GET_STATUS: 'app:update-get-status',
  /** main→renderer：更新状态推送（检查/下载进度等） */
  APP_UPDATE_STATUS: 'app:update-status',
  /** invoke：打开文件对话框（文档） */
  FILE_OPEN: 'file:open',
  /** invoke：打开文件夹对话框（工作区根） */
  FILE_OPEN_FOLDER: 'file:open-folder',
  /** invoke：扫描已有工作区路径，返回文件树 */
  FILE_SCAN_WORKSPACE: 'file:scan-workspace',
  /** invoke：按路径读文本文件 */
  FILE_READ: 'file:read',
  /** invoke：按路径读二进制文件 */
  FILE_READ_BINARY: 'file:read-binary',
  /** invoke：保存到当前路径（可弹对话框） */
  FILE_SAVE: 'file:save',
  /** invoke：另存为 */
  FILE_SAVE_AS: 'file:save-as',
  /** invoke：读图片并转 data URL（预览/粘贴用） */
  FILE_READ_IMAGE: 'file:read-image',
  /** invoke：把粘贴的图片写入工作区并返回路径 */
  FILE_SAVE_PASTED_IMAGE: 'file:save-pasted-image',
  /** invoke：导出 HTML */
  FILE_EXPORT_HTML: 'file:export-html',
  /** invoke：导出 PDF */
  FILE_EXPORT_PDF: 'file:export-pdf',
  /** invoke：导出 Markdown */
  FILE_EXPORT_MARKDOWN: 'file:export-markdown',
  /** send：根据路径/脏标记更新窗口标题 */
  FILE_UPDATE_TITLE: 'file:update-title',
  /** invoke：在工作区新建文件 */
  FILE_CREATE: 'file:create',
  /** invoke：在工作区新建目录 */
  FILE_CREATE_DIR: 'file:create-dir',
  /** invoke：重命名工作区路径 */
  FILE_RENAME: 'file:rename',
  /** invoke：删除工作区路径 */
  FILE_DELETE: 'file:delete',
  /** invoke：复制工作区路径 */
  FILE_COPY: 'file:copy',
  /** invoke：移动工作区路径 */
  FILE_MOVE: 'file:move',
  /** send：开始监听工作区文件变化 */
  WORKSPACE_WATCH: 'workspace:watch',
  /** send：停止监听工作区 */
  WORKSPACE_UNWATCH: 'workspace:unwatch',
  /** main→renderer：工作区磁盘变化，渲染进程应刷新树 */
  WORKSPACE_CHANGED: 'workspace:changed',
  /** invoke：列出某文件的阅读书签/批注 */
  MARKS_LIST: 'marks:list',
  /** invoke：新建阅读书签/批注 */
  MARKS_CREATE: 'marks:create',
  /** invoke：更新阅读书签/批注 */
  MARKS_UPDATE: 'marks:update',
  /** invoke：删除阅读书签/批注 */
  MARKS_DELETE: 'marks:delete',
  /** invoke：列出可用 ACP Agent 运行时（如 codex-acp） */
  ACP_LIST_RUNTIMES: 'acp:list-runtimes',
  /** invoke：拉起 ACP 传输并连接 */
  ACP_CONNECT: 'acp:connect',
  /** invoke：断开 ACP 并清理子进程 */
  ACP_DISCONNECT: 'acp:disconnect',
  /** invoke：ACP session/new */
  ACP_SESSION_NEW: 'acp:session-new',
  /** invoke：向当前 session 发送 prompt */
  ACP_PROMPT: 'acp:prompt',
  /** invoke：取消正在进行的 prompt */
  ACP_CANCEL: 'acp:cancel',
  /** invoke：设置 ACP 会话配置项（模型等） */
  ACP_SET_CONFIG_OPTION: 'acp:set-config-option',
  /** send：渲染进程回复 Agent 的权限询问 */
  ACP_PERMISSION_RESPONSE: 'acp:permission-response',
  /** invoke：连接前探测 Codex/ACP 认证是否已就绪 */
  ACP_AUTH_PREFLIGHT: 'acp:auth-preflight',
  /** invoke：走 ACP authMethods 完成认证 */
  ACP_AUTHENTICATE: 'acp:authenticate',
  /** invoke：加载已有 ACP session（恢复历史） */
  ACP_LOAD_SESSION: 'acp:load-session',
  /** main→renderer：ACP session/update 流式事件 */
  ACP_SESSION_UPDATE: 'acp:session-update',
  /** main→renderer：ACP 连接/会话状态变化 */
  ACP_STATUS_CHANGED: 'acp:status-changed',
  /** main→renderer：Agent 请求工具权限，需 UI 确认 */
  ACP_PERMISSION_REQUEST: 'acp:permission-request',
  /** main→renderer：Agent 要当前编辑器/阅读器快照 */
  ACP_SNAPSHOT_REQUEST: 'acp:snapshot-request',
  /** send：渲染进程回传快照内容 */
  ACP_SNAPSHOT_RESPONSE: 'acp:snapshot-response',
  /** invoke：抓取在线文档一页 HTML */
  WEB_DOC_FETCH_PAGE: 'web-doc:fetch-page',
  /** invoke：发现在线文档目录（TOC） */
  WEB_DOC_DISCOVER_TOC: 'web-doc:discover-toc',
  /** invoke：读取 PDF OCR 目录缓存 */
  OCR_GET_PDF_TOC: 'ocr:get-pdf-toc',
  /** invoke：对 PDF 目录页做 OCR 并缓存 */
  OCR_RECOGNIZE_PDF_TOC: 'ocr:recognize-pdf-toc',
  /** invoke：删除某 PDF 的目录 OCR 缓存 */
  OCR_DELETE_PDF_TOC: 'ocr:delete-pdf-toc',
  /** invoke：读取某页 PDF OCR 缓存 */
  OCR_GET_PDF_PAGE: 'ocr:get-pdf-page',
  /** invoke：对指定 PDF 页 OCR 并缓存 */
  OCR_RECOGNIZE_PDF_PAGE: 'ocr:recognize-pdf-page',
  /** invoke：列出已缓存 OCR 的 PDF 页码 */
  OCR_LIST_PDF_PAGES: 'ocr:list-pdf-pages',
  /** invoke：清除单个 PDF 的 OCR 缓存 */
  OCR_CLEAR_PDF_CACHE: 'ocr:clear-pdf-cache',
  /** invoke：清除全部 PDF OCR 缓存 */
  OCR_CLEAR_ALL_CACHE: 'ocr:clear-all-cache',
  /** invoke：手动保存 PDF 目录 OCR 结果 */
  OCR_SAVE_PDF_TOC: 'ocr:save-pdf-toc',
  /** invoke：OCR 组件（语言包/引擎）是否就绪 */
  OCR_GET_COMPONENT_STATUS: 'ocr:get-component-status',
  /** invoke：下载并确保 OCR 组件可用 */
  OCR_ENSURE_COMPONENT: 'ocr:ensure-component',
  /** invoke：取消 OCR 组件下载 */
  OCR_CANCEL_COMPONENT_DOWNLOAD: 'ocr:cancel-component-download',
  /** main→renderer：OCR 组件下载/就绪状态推送 */
  OCR_COMPONENT_STATUS: 'ocr:component-status',
} as const

/** `IPC` 全部通道字符串的联合类型，用于约束 handle/on/invoke 的 channel 参数 */
export type IpcChannel = (typeof IPC)[keyof typeof IPC]
