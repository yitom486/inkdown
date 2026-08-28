/** 渲染进程上报主进程的错误条目 */
export interface RendererErrorPayload {
  timestamp: string
  level: 'error' | 'warning'
  source: string
  message: string
  stack?: string
  componentStack?: string
  filePath?: string
}
