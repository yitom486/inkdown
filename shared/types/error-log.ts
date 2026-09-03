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
}
