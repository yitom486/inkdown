import {
  INKDOWN_VIRTUAL_RESOURCES,
  isInkdownVirtualDirPath,
  parseInkdownVirtualPath,
  type InkdownVirtualResource,
} from '@shared/agent/inkdown-virtual-fs'
import type { JsonRpcId, JsonRpcRequest, JsonRpcTransport } from './jsonrpc-transport'
import { acpReadTextFile, acpWriteTextFile } from './acp-fs'
import type { AcpTerminalManager } from './acp-terminal'

export type PermissionDecision =
  | { outcome: 'selected'; optionId: string }
  | { outcome: 'cancelled' }

export type PermissionRequestHandler = (payload: {
  requestId: JsonRpcId
  params: Record<string, unknown>
}) => Promise<PermissionDecision>

export interface AcpClientHandlerContext {
  getWorkspaceRoot: () => string | null
  terminals: AcpTerminalManager
  /** 读取 Inkdown 虚拟文件：向渲染进程要内存快照，不碰磁盘 */
  readSnapshot: (resource: InkdownVirtualResource) => Promise<string>
}

function asParams(message: JsonRpcRequest): Record<string, unknown> {
  return message.params && typeof message.params === 'object'
    ? (message.params as Record<string, unknown>)
    : {}
}

function parseEnv(raw: unknown): Array<{ name: string; value: string }> | undefined {
  if (!Array.isArray(raw)) return undefined
  const rows: Array<{ name: string; value: string }> = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    if (typeof row.name !== 'string' || typeof row.value !== 'string') continue
    rows.push({ name: row.name, value: row.value })
  }
  return rows.length > 0 ? rows : undefined
}

function parseArgs(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  return raw.filter((item): item is string => typeof item === 'string')
}

/**
 * 处理 Agent → Client 的请求：permission + fs + terminal（声明能力后才会收到）。
 */
export function createAcpClientMethodRouter(
  transport: JsonRpcTransport,
  onPermission: PermissionRequestHandler,
  context: AcpClientHandlerContext,
): (message: JsonRpcRequest) => Promise<void> {
  return async (message) => {
    const params = asParams(message)
    // 诊断：哪些 Client 方法真正被 Agent 调到（权限是否压根没来）
    if (
      message.method === 'session/request_permission' ||
      message.method.startsWith('fs/') ||
      message.method.startsWith('terminal/')
    ) {
      const toolCall = params.toolCall
      const toolHint =
        toolCall && typeof toolCall === 'object'
          ? {
              id:
                typeof (toolCall as { toolCallId?: unknown }).toolCallId === 'string'
                  ? (toolCall as { toolCallId: string }).toolCallId
                  : typeof (toolCall as { id?: unknown }).id === 'string'
                    ? (toolCall as { id: string }).id
                    : undefined,
              title:
                typeof (toolCall as { title?: unknown }).title === 'string'
                  ? (toolCall as { title: string }).title
                  : undefined,
              kind:
                typeof (toolCall as { kind?: unknown }).kind === 'string'
                  ? (toolCall as { kind: string }).kind
                  : undefined,
            }
          : undefined
      console.info('[acp] ← Agent request', {
        id: message.id,
        method: message.method,
        path: typeof params.path === 'string' ? params.path : undefined,
        toolCall: toolHint,
        optionCount: Array.isArray(params.options) ? params.options.length : undefined,
      })
    }

    if (message.method === 'session/request_permission') {
      try {
        console.info('[acp] session/request_permission 开始等待 UI 审批', {
          requestId: message.id,
        })
        const decision = await onPermission({ requestId: message.id, params })
        console.info('[acp] session/request_permission 已决议', {
          requestId: message.id,
          decision,
        })
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
      const workspaceRoot = context.getWorkspaceRoot()
      const filePath = typeof params.path === 'string' ? params.path : ''
      if (!workspaceRoot || !filePath) {
        transport.respondError(message.id, {
          code: -32602,
          message: 'fs/read_text_file 需要 path 与已连接工作区',
        })
        return
      }
      const virtualResource = parseInkdownVirtualPath(filePath, workspaceRoot)
      if (virtualResource) {
        try {
          const content = await context.readSnapshot(virtualResource)
          console.info('[acp] fs/read_text_file 虚拟快照 ok', {
            resource: virtualResource,
            chars: content.length,
          })
          transport.respond(message.id, { content })
        } catch (error) {
          transport.respondError(message.id, {
            code: -32000,
            message: error instanceof Error ? error.message : '读取 Inkdown 快照失败',
          })
        }
        return
      }

      if (isInkdownVirtualDirPath(filePath, workspaceRoot)) {
        transport.respondError(message.id, {
          code: -32602,
          message: `Inkdown 虚拟目录下可读：${INKDOWN_VIRTUAL_RESOURCES.join('、')}`,
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
        console.info('[acp] fs/read_text_file ok', { path: filePath })
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
        // 注意：ACP 约定敏感写操作应由 Agent 先 session/request_permission；
        // 若此处直接写入且从未见 request_permission，说明 Agent 认为工作区内写无需再问。
        console.info('[acp] fs/write_text_file（无内嵌审批，依赖 Agent 是否先 request_permission）', {
          path: filePath,
          bytes: content.length,
        })
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

    if (message.method === 'terminal/create') {
      const params = asParams(message)
      const workspaceRoot = context.getWorkspaceRoot()
      const sessionId = typeof params.sessionId === 'string' ? params.sessionId : ''
      const command = typeof params.command === 'string' ? params.command : ''
      if (!workspaceRoot || !sessionId || !command) {
        transport.respondError(message.id, {
          code: -32602,
          message: 'terminal/create 需要 sessionId、command 与已连接工作区',
        })
        return
      }
      try {
        const result = context.terminals.create({
          sessionId,
          command,
          args: parseArgs(params.args),
          env: parseEnv(params.env),
          cwd: typeof params.cwd === 'string' ? params.cwd : undefined,
          outputByteLimit:
            typeof params.outputByteLimit === 'number' ? params.outputByteLimit : undefined,
          workspaceRoot,
        })
        transport.respond(message.id, result)
      } catch (error) {
        transport.respondError(message.id, {
          code: -32000,
          message: error instanceof Error ? error.message : '创建终端失败',
        })
      }
      return
    }

    if (message.method === 'terminal/output') {
      const params = asParams(message)
      const terminalId = typeof params.terminalId === 'string' ? params.terminalId : ''
      if (!terminalId) {
        transport.respondError(message.id, {
          code: -32602,
          message: 'terminal/output 需要 terminalId',
        })
        return
      }
      try {
        transport.respond(message.id, context.terminals.getOutput(terminalId))
      } catch (error) {
        transport.respondError(message.id, {
          code: -32000,
          message: error instanceof Error ? error.message : '读取终端输出失败',
        })
      }
      return
    }

    if (message.method === 'terminal/wait_for_exit') {
      const params = asParams(message)
      const terminalId = typeof params.terminalId === 'string' ? params.terminalId : ''
      if (!terminalId) {
        transport.respondError(message.id, {
          code: -32602,
          message: 'terminal/wait_for_exit 需要 terminalId',
        })
        return
      }
      try {
        const status = await context.terminals.waitForExit(terminalId)
        transport.respond(message.id, status)
      } catch (error) {
        transport.respondError(message.id, {
          code: -32000,
          message: error instanceof Error ? error.message : '等待终端退出失败',
        })
      }
      return
    }

    if (message.method === 'terminal/kill') {
      const params = asParams(message)
      const terminalId = typeof params.terminalId === 'string' ? params.terminalId : ''
      if (!terminalId) {
        transport.respondError(message.id, {
          code: -32602,
          message: 'terminal/kill 需要 terminalId',
        })
        return
      }
      try {
        transport.respond(message.id, context.terminals.kill(terminalId))
      } catch (error) {
        transport.respondError(message.id, {
          code: -32000,
          message: error instanceof Error ? error.message : '终止终端失败',
        })
      }
      return
    }

    if (message.method === 'terminal/release') {
      const params = asParams(message)
      const terminalId = typeof params.terminalId === 'string' ? params.terminalId : ''
      if (!terminalId) {
        transport.respondError(message.id, {
          code: -32602,
          message: 'terminal/release 需要 terminalId',
        })
        return
      }
      try {
        transport.respond(message.id, context.terminals.release(terminalId))
      } catch (error) {
        transport.respondError(message.id, {
          code: -32000,
          message: error instanceof Error ? error.message : '释放终端失败',
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

function permissionOptionId(option: Record<string, unknown>): string | null {
  if (typeof option.optionId === 'string') return option.optionId
  if (typeof option.id === 'string') return option.id
  return null
}

/** 从 permission options 中挑一个「允许」类 optionId，否则 cancelled */
export function pickAllowOptionId(params: Record<string, unknown>): string | null {
  const options = params.options
  if (!Array.isArray(options)) return null
  for (const item of options) {
    if (!item || typeof item !== 'object') continue
    const option = item as Record<string, unknown>
    const id = permissionOptionId(option)
    const kind = typeof option.kind === 'string' ? option.kind : ''
    if (id && (kind.includes('allow') || kind === 'allow_once' || kind === 'allow_always')) {
      return id
    }
  }
  for (const item of options) {
    if (!item || typeof item !== 'object') continue
    const id = permissionOptionId(item as Record<string, unknown>)
    if (id) return id
  }
  return null
}
