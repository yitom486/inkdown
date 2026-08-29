import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  encodeJsonRpcMessage,
  JsonRpcTransport,
  parseJsonRpcLine,
} from './jsonrpc-transport'

describe('parseJsonRpcLine / encodeJsonRpcMessage', () => {
  it('round-trips request', () => {
    const line = encodeJsonRpcMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: 1 },
    }).trimEnd()
    const parsed = parseJsonRpcLine(line)
    expect(parsed).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
    })
  })

  it('rejects invalid json', () => {
    expect(() => parseJsonRpcLine('{nope')).toThrow(/无效 JSON-RPC/)
  })
})

describe('JsonRpcTransport', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('pairs request with response', async () => {
    const agentOut = new PassThrough()
    const clientIn = new PassThrough()
    // Client reads agentOut, writes clientIn
    // Agent reads clientIn, writes agentOut — we simulate agent in test

    const transport = new JsonRpcTransport(agentOut, clientIn, { requestTimeoutMs: 5_000 })

    const pending = transport.request('ping', { n: 1 })

    // Read what client wrote
    const written = await new Promise<string>((resolve) => {
      clientIn.once('data', (chunk) => resolve(chunk.toString('utf8')))
    })
    const req = JSON.parse(written.trim()) as { id: number; method: string }
    expect(req.method).toBe('ping')

    agentOut.write(
      encodeJsonRpcMessage({
        jsonrpc: '2.0',
        id: req.id,
        result: { ok: true },
      }),
    )

    await expect(pending).resolves.toEqual({ ok: true })
    transport.dispose()
  })

  it('dispatches notifications via onMessage', async () => {
    const agentOut = new PassThrough()
    const clientIn = new PassThrough()
    const onMessage = vi.fn()

    const transport = new JsonRpcTransport(agentOut, clientIn, { onMessage })

    agentOut.write(
      encodeJsonRpcMessage({
        jsonrpc: '2.0',
        method: 'session/update',
        params: { sessionId: 's1', update: { sessionUpdate: 'agent_message_chunk' } },
      }),
    )

    await vi.waitFor(() => {
      expect(onMessage).toHaveBeenCalled()
    })

    expect(onMessage.mock.calls[0]?.[0]).toMatchObject({
      method: 'session/update',
    })
    transport.dispose()
  })

  it('rejects pending on timeout', async () => {
    vi.useFakeTimers()
    const agentOut = new PassThrough()
    const clientIn = new PassThrough()
    const transport = new JsonRpcTransport(agentOut, clientIn, { requestTimeoutMs: 100 })

    const pending = transport.request('slow')
    const assertion = expect(pending).rejects.toThrow(/超时/)
    await vi.advanceTimersByTimeAsync(150)
    await assertion
    transport.dispose()
  })
})
