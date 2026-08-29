import type { JsonRpcId, JsonRpcRequest, JsonRpcTransport } from './jsonrpc-transport'
import { acpReadTextFile, acpWriteTextFile } from './acp-fs'

export type PermissionDecision =
  | { outcome: 'selected'; optionId: string }
  | { outcome: 'cancelled' }

export type PermissionRequestHandler = (payload: {
  requestId: JsonRpcId
  params: Record<string, unknown>
}) => Promise<PermissionDecision>

export interface AcpClientHandlerContext {
  getWorkspaceRoot: () => string | null
}

/**
 * 处理 Agent → Client 的请求：permission + fs（声明能力后才会收到）。
 */
export function createAcpClientMethodRouter(
  transport: JsonRpcTransport,
  onPermission: PermissionRequestHandler,
  context: AcpClientHandlerContext,
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

    if (message.method === 'fs/read_text_file') {
      const params =
        message.params && typeof message.params === 'object'
          ? (message.params as Record<string, unknown>)
          : {}
      const workspaceRoot = context.getWorkspaceRoot()
      const filePath = typeof params.path === 'string' ? params.path : ''
      if (!workspaceRoot || !filePath) {
        transport.respondError(message.id, {
          code: -32602,
          message: 'fs/read_text_file 需要 path 与已连接工作区',
        })
        return
      }
      try {
        const result = await acpReadTextFile({
          path: filePath,
          workspaceRoot,
          line: typeof params.line === 'number' ? params.line : undefined,
          limit: typeof params.limit === 'number' ? params.limit : undefined,
        })
        transport.respond(message.id, result)
      } catch (error) {
        transport.respondError(message.id, {
          code: -32000,
          message: error instanceof Error ? error.message : '读取文件失败',
        })
      }
      return
    }

    if (message.method === 'fs/write_text_file') {
      const params =
        message.params && typeof message.params === 'object'
          ? (message.params as Record<string, unknown>)
          : {}
      const workspaceRoot = context.getWorkspaceRoot()
      const filePath = typeof params.path === 'string' ? params.path : ''
      const content = typeof params.content === 'string' ? params.content : null
      if (!workspaceRoot || !filePath || content === null) {
        transport.respondError(message.id, {
          code: -32602,
          message: 'fs/write_text_file 需要 path、content 与已连接工作区',
        })
        return
      }
      try {
        const result = await acpWriteTextFile({
          path: filePath,
          content,
          workspaceRoot,
        })
        transport.respond(message.id, result)
      } catch (error) {
        transport.respondError(message.id, {
          code: -32000,
          message: error instanceof Error ? error.message : '写入文件失败',
        })
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
