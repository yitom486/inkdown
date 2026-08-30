import {
  callInkdownMcpTool,
  INKDOWN_MCP_TOOLS,
  type InkdownMcpToolContext,
} from './inkdown-mcp-tools'

/** 客户端未声明版本时的兜底；有声明就原样回声，兼容各修订 */
const FALLBACK_PROTOCOL_VERSION = '2025-06-18'

export interface McpRpcMessage {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
}

export type McpRpcResponse = Record<string, unknown>

function result(id: McpRpcMessage['id'], value: unknown): McpRpcResponse {
  return { jsonrpc: '2.0', id, result: value }
}

function rpcError(
  id: McpRpcMessage['id'],
  code: number,
  message: string,
): McpRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

function isNotification(message: McpRpcMessage): boolean {
  return message.id === undefined || message.id === null
}

/**
 * 最小 MCP 服务端分发：initialize / tools/list / tools/call / ping。
 * 返回 null 表示这是通知，HTTP 层应回 202 且无 body。
 */
export async function handleInkdownMcpRpc(
  message: McpRpcMessage,
  context: InkdownMcpToolContext,
): Promise<McpRpcResponse | null> {
  const method = message.method
  if (!method) {
    return isNotification(message) ? null : rpcError(message.id, -32600, '缺少 method')
  }

  if (isNotification(message)) return null

  switch (method) {
    case 'initialize': {
      const requested = message.params?.protocolVersion
      return result(message.id, {
        protocolVersion: typeof requested === 'string' ? requested : FALLBACK_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'inkdown', version: '1' },
      })
    }

    case 'ping':
      return result(message.id, {})

    case 'tools/list':
      return result(message.id, { tools: INKDOWN_MCP_TOOLS })

    case 'tools/call': {
      const name = message.params?.name
      if (typeof name !== 'string') {
        return rpcError(message.id, -32602, 'tools/call 需要 name')
      }
      const rawArgs = message.params?.arguments
      const args =
        rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)
          ? (rawArgs as Record<string, unknown>)
          : undefined
      try {
        return result(message.id, await callInkdownMcpTool(name, context, args))
      } catch (error) {
        // 工具执行失败按 MCP 约定回 isError 结果，让模型能读到原因并自行调整
        return result(message.id, {
          content: [
            {
              type: 'text',
              text: error instanceof Error ? error.message : '工具执行失败',
            },
          ],
          isError: true,
        })
      }
    }

    default:
      return rpcError(message.id, -32601, `未实现的方法: ${method}`)
  }
}
