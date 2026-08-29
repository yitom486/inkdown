import type { JsonRpcId, JsonRpcRequest, JsonRpcTransport } from './jsonrpc-transport'

export type PermissionDecision =
  | { outcome: 'selected'; optionId: string }
  | { outcome: 'cancelled' }

export type PermissionRequestHandler = (payload: {
  requestId: JsonRpcId
  params: Record<string, unknown>
}) => Promise<PermissionDecision>

/**
 * 处理 Agent → Client 的 baseline 请求。
 * 首版仅实现 session/request_permission；fs/terminal 未声明能力故不应收到。
 */
export function createAcpClientMethodRouter(
  transport: JsonRpcTransport,
  onPermission: PermissionRequestHandler,
): (message: JsonRpcRequest) => Promise<void> {
  return async (message) => {
    if (message.method === 'session/request_permission') {
      const params =
        message.params && typeof message.params === 'object'
          ? (message.params as Record<string, unknown>)
          : {}
      try {
        const decision = await onPermission({ requestId: message.id, params })
        transport.respond(message.id, { outcome: decision })
      } catch (error) {
        transport.respond(message.id, {
          outcome: { outcome: 'cancelled' },
        })
        console.error('[acp] request_permission 失败', error)
      }
      return
    }

    transport.respondError(message.id, {
      code: -32601,
      message: `Client 未实现方法: ${message.method}`,
    })
  }
}

/** 从 permission options 中挑一个「允许」类 optionId，否则 cancelled */
export function pickAllowOptionId(params: Record<string, unknown>): string | null {
  const options = params.options
  if (!Array.isArray(options)) return null
  for (const item of options) {
    if (!item || typeof item !== 'object') continue
    const option = item as Record<string, unknown>
    const id = typeof option.optionId === 'string' ? option.optionId : null
    const kind = typeof option.kind === 'string' ? option.kind : ''
    if (id && (kind.includes('allow') || kind === 'allow_once' || kind === 'allow_always')) {
      return id
    }
  }
  for (const item of options) {
    if (!item || typeof item !== 'object') continue
    const option = item as Record<string, unknown>
    if (typeof option.optionId === 'string') return option.optionId
  }
  return null
}
