/** 渲染进程上报主进程的错误条目（写入日志文件，不弹窗） */
export interface RendererErrorPayload {
  timestamp: string
  level: 'error' | 'warning'
  /** 来源标签，如 React / 某 viewer */
  source: string
  message: string
  stack?: string
  /** React 组件栈，与 JS stack 分开 */
  componentStack?: string
  filePath?: string
  /** 失败的操作（如 sync/upload/ocr/fetch），便于按操作聚合 */
  op?: string
  /** 结构化上下文（如 latencyMs、httpStatus、retryCount），JSON 可序列化 */
  data?: Record<string, unknown>
}
