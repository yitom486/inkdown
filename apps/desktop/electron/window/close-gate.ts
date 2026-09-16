/** 等待渲染进程回应关闭请求的最长时间 */
export const CLOSE_RENDERER_RESPONSE_TIMEOUT_MS = 5000

export type RendererHealth = 'ok' | 'crashed' | 'unresponsive'

export type CloseInterceptAction = 'allow' | 'ask-renderer' | 'ask-main-force'

export function isRendererAvailable(health: RendererHealth, webContentsCrashed: boolean): boolean {
  return health === 'ok' && !webContentsCrashed
}

/** 决定主进程应如何处理窗口关闭请求 */
export function resolveCloseInterceptAction(input: {
  allowClose: boolean
  documentDirty: boolean
  rendererAvailable: boolean
}): CloseInterceptAction {
  if (input.allowClose || !input.documentDirty) return 'allow'
  if (!input.rendererAvailable) return 'ask-main-force'
  return 'ask-renderer'
}
