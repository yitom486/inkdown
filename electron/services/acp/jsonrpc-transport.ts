import type { Readable, Writable } from 'node:stream'

export type JsonRpcId = number | string

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: JsonRpcId
  method: string
  params?: unknown
}

export interface JsonRpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: unknown
}

export interface JsonRpcSuccess {
  jsonrpc: '2.0'
  id: JsonRpcId
  result: unknown
}

export interface JsonRpcErrorObject {
  code: number
  message: string
  data?: unknown
}

export interface JsonRpcErrorResponse {
  jsonrpc: '2.0'
  id: JsonRpcId | null
  error: JsonRpcErrorObject
}

export type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcSuccess
  | JsonRpcErrorResponse

export type JsonRpcIncomingHandler = (message: JsonRpcMessage) => void | Promise<void>

export class JsonRpcTransportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JsonRpcTransportError'
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseJsonRpcLine(line: string): JsonRpcMessage {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    throw new JsonRpcTransportError(`无效 JSON-RPC 行: ${line.slice(0, 200)}`)
  }

  if (!isObject(parsed) || parsed.jsonrpc !== '2.0') {
    throw new JsonRpcTransportError('缺少 jsonrpc: 2.0')
  }

  return parsed as unknown as JsonRpcMessage
}

export function encodeJsonRpcMessage(message: JsonRpcMessage): string {
  return `${JSON.stringify(message)}\n`
}

export function isJsonRpcResponse(
  message: JsonRpcMessage,
): message is JsonRpcSuccess | JsonRpcErrorResponse {
  return 'id' in message && ('result' in message || 'error' in message)
}

export function isJsonRpcRequest(message: JsonRpcMessage): message is JsonRpcRequest {
  return 'method' in message && 'id' in message && !('result' in message) && !('error' in message)
}

export function isJsonRpcNotification(message: JsonRpcMessage): message is JsonRpcNotification {
  return 'method' in message && !('id' in message)
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export interface JsonRpcTransportOptions {
  requestTimeoutMs?: number
  onMessage?: JsonRpcIncomingHandler
  onError?: (error: Error) => void
}

/**
 * 行分隔 JSON-RPC 2.0 传输（ACP stdio）。
 * 可读侧按 \\n 拆包；请求用 id 映射等待响应。
 */
export class JsonRpcTransport {
  private buffer = ''
  private nextId = 1
  private readonly pending = new Map<string, PendingRequest>()
  private closed = false
  private readonly requestTimeoutMs: number
  private readonly onMessage?: JsonRpcIncomingHandler
  private readonly onError?: (error: Error) => void
  private readonly onReadableData: (chunk: Buffer | string) => void
  private readonly onReadableEnd: () => void
  private readonly onReadableError: (error: Error) => void

  constructor(
    private readonly readable: Readable,
    private readonly writable: Writable,
    options: JsonRpcTransportOptions = {},
  ) {
    this.requestTimeoutMs = options.requestTimeoutMs ?? 60_000
    this.onMessage = options.onMessage
    this.onError = options.onError

    this.onReadableData = (chunk) => {
      this.buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
      this.flushLines()
    }
    this.onReadableEnd = () => {
      this.rejectAll(new JsonRpcTransportError('stdio 已关闭'))
    }
    this.onReadableError = (error) => {
      this.onError?.(error)
      this.rejectAll(error)
    }

    this.readable.on('data', this.onReadableData)
    this.readable.on('end', this.onReadableEnd)
    this.readable.on('error', this.onReadableError)
  }

  request(method: string, params?: unknown): Promise<unknown> {
    if (this.closed) {
      return Promise.reject(new JsonRpcTransportError('传输已关闭'))
    }

    const id = this.nextId++
    const key = String(id)
    const message: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      ...(params !== undefined ? { params } : {}),
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(key)
        reject(new JsonRpcTransportError(`请求超时: ${method}`))
      }, this.requestTimeoutMs)

      this.pending.set(key, { resolve, reject, timer })
      try {
        this.write(message)
      } catch (error) {
        clearTimeout(timer)
        this.pending.delete(key)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  notify(method: string, params?: unknown): void {
    const message: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      ...(params !== undefined ? { params } : {}),
    }
    this.write(message)
  }

  /** 响应 Agent→Client 的请求 */
  respond(id: JsonRpcId, result: unknown): void {
    const message: JsonRpcSuccess = { jsonrpc: '2.0', id, result }
    this.write(message)
  }

  respondError(id: JsonRpcId, error: JsonRpcErrorObject): void {
    const message: JsonRpcErrorResponse = { jsonrpc: '2.0', id, error }
    this.write(message)
  }

  dispose(): void {
    if (this.closed) return
    this.closed = true
    this.readable.off('data', this.onReadableData)
    this.readable.off('end', this.onReadableEnd)
    this.readable.off('error', this.onReadableError)
    this.rejectAll(new JsonRpcTransportError('传输已销毁'))
  }

  private write(message: JsonRpcMessage): void {
    if (this.closed) {
      throw new JsonRpcTransportError('传输已关闭')
    }
    const ok = this.writable.write(encodeJsonRpcMessage(message), 'utf8')
    if (!ok) {
      // 背压时仍继续；Agent 侧通常能跟上
    }
  }

  private flushLines(): void {
    while (true) {
      const idx = this.buffer.indexOf('\n')
      if (idx < 0) break
      const line = this.buffer.slice(0, idx).replace(/\r$/, '')
      this.buffer = this.buffer.slice(idx + 1)
      if (!line.trim()) continue
      try {
        const message = parseJsonRpcLine(line)
        void this.dispatch(message)
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        this.onError?.(err)
      }
    }
  }

  private async dispatch(message: JsonRpcMessage): Promise<void> {
    if (isJsonRpcResponse(message)) {
      const key = String(message.id)
      const pending = this.pending.get(key)
      if (!pending) return
      this.pending.delete(key)
      clearTimeout(pending.timer)
      if ('error' in message && message.error) {
        pending.reject(
          new JsonRpcTransportError(`${message.error.message} (code ${message.error.code})`),
        )
      } else {
        pending.resolve('result' in message ? message.result : undefined)
      }
      return
    }

    await this.onMessage?.(message)
  }

  private rejectAll(error: Error): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.pending.clear()
  }
}
