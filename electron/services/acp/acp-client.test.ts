import { PassThrough } from 'node:stream'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createAcpClientMethodRouter, pickAllowOptionId } from './client-handlers'
import {
  encodeJsonRpcMessage,
  JsonRpcTransport,
  isJsonRpcRequest,
} from './jsonrpc-transport'
import { AcpTerminalManager } from './acp-terminal'

function testContext(workspaceRoot: string | null = null) {
  return {
    getWorkspaceRoot: () => workspaceRoot,
    terminals: new AcpTerminalManager(),
  }
}

describe('pickAllowOptionId', () => {
  it('prefers allow_once kind', () => {
    const id = pickAllowOptionId({
      options: [
        { optionId: 'reject-once', kind: 'reject_once' },
        { optionId: 'allow-once', kind: 'allow_once' },
      ],
    })
    expect(id).toBe('allow-once')
  })

  it('falls back to id when optionId missing', () => {
    const id = pickAllowOptionId({
      options: [{ id: 'allow-once', kind: 'allow_once' }],
    })
    expect(id).toBe('allow-once')
  })

  it('returns null when no options', () => {
    expect(pickAllowOptionId({})).toBeNull()
  })
})

describe('AcpTerminalManager path guard', () => {
  it('rejects cwd outside workspace', () => {
    const mgr = new AcpTerminalManager()
    const root = process.cwd()
    expect(() =>
      mgr.create({
        sessionId: 's1',
        command: process.execPath,
        args: ['-e', ''],
        cwd: resolve(root, '..', `__acp_term_outside_${Date.now()}`),
        workspaceRoot: root,
      }),
    ).toThrow(/工作区/)
  })
})

describe('createAcpClientMethodRouter', () => {
  it('responds to session/request_permission', async () => {
    const agentOut = new PassThrough()
    const clientIn = new PassThrough()
    const transport = new JsonRpcTransport(agentOut, clientIn)

    let seenParams: Record<string, unknown> | null = null
    const router = createAcpClientMethodRouter(
      transport,
      async ({ params }) => {
        seenParams = params as Record<string, unknown>
        return {
          outcome: 'selected',
          optionId: 'allow-once',
        }
      },
      testContext(null),
    )

    const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
      clientIn.on('data', (chunk) => {
        resolve(JSON.parse(chunk.toString('utf8').trim()) as Record<string, unknown>)
      })
    })

    await router({
      jsonrpc: '2.0',
      id: 5,
      method: 'session/request_permission',
      params: {
        toolCall: { toolCallId: 'tc-1', title: 'Delete file', kind: 'delete' },
        options: [{ optionId: 'allow-once', kind: 'allow_once' }],
      },
    })

    const response = await responsePromise
    expect(seenParams).not.toBeNull()
    expect(seenParams!.toolCall).toMatchObject({ toolCallId: 'tc-1' })
    expect(response).toMatchObject({
      id: 5,
      result: {
        outcome: {
          outcome: 'selected',
          optionId: 'allow-once',
        },
      },
    })
    transport.dispose()
  })

  it('permission handler can reject via optionId', async () => {
    const agentOut = new PassThrough()
    const clientIn = new PassThrough()
    const transport = new JsonRpcTransport(agentOut, clientIn)

    const router = createAcpClientMethodRouter(
      transport,
      async () => ({
        outcome: 'selected',
        optionId: 'reject-once',
      }),
      testContext(null),
    )

    const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
      clientIn.on('data', (chunk) => {
        resolve(JSON.parse(chunk.toString('utf8').trim()) as Record<string, unknown>)
      })
    })

    await router({
      jsonrpc: '2.0',
      id: 6,
      method: 'session/request_permission',
      params: {
        options: [
          { optionId: 'allow-once', kind: 'allow_once' },
          { optionId: 'reject-once', kind: 'reject_once' },
        ],
      },
    })

    const response = await responsePromise
    expect(response).toMatchObject({
      result: { outcome: { outcome: 'selected', optionId: 'reject-once' } },
    })
    transport.dispose()
  })

  it('terminal/create without workspace returns RPC error', async () => {
    const agentOut = new PassThrough()
    const clientIn = new PassThrough()
    const transport = new JsonRpcTransport(agentOut, clientIn)

    const router = createAcpClientMethodRouter(
      transport,
      async () => ({ outcome: 'cancelled' }),
      testContext(null),
    )

    const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
      clientIn.on('data', (chunk) => {
        resolve(JSON.parse(chunk.toString('utf8').trim()) as Record<string, unknown>)
      })
    })

    await router({
      jsonrpc: '2.0',
      id: 12,
      method: 'terminal/create',
      params: { sessionId: 'sess_1', command: 'echo' },
    })

    const response = await responsePromise
    expect(response).toMatchObject({
      id: 12,
      error: { code: -32602 },
    })
    transport.dispose()
  })
})

describe('Acp client message routing (mock duplex)', () => {
  it('handles Agent request via onMessage router', async () => {
    const agentOut = new PassThrough()
    const clientIn = new PassThrough()

    const transport = new JsonRpcTransport(agentOut, clientIn, {
      onMessage: async (message) => {
        if (!isJsonRpcRequest(message)) return
        const router = createAcpClientMethodRouter(
          transport,
          async () => ({
            outcome: 'cancelled',
          }),
          testContext(null),
        )
        await router(message)
      },
    })

    const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
      clientIn.on('data', (chunk) => {
        resolve(JSON.parse(chunk.toString('utf8').trim()) as Record<string, unknown>)
      })
    })

    agentOut.write(
      encodeJsonRpcMessage({
        jsonrpc: '2.0',
        id: 9,
        method: 'session/request_permission',
        params: { options: [] },
      }),
    )

    const response = await responsePromise
    expect(response).toMatchObject({
      id: 9,
      result: { outcome: { outcome: 'cancelled' } },
    })
    transport.dispose()
  })

  it('simulates initialize → session/new handshake', async () => {
    const agentOut = new PassThrough()
    const clientIn = new PassThrough()
    const transport = new JsonRpcTransport(agentOut, clientIn, { requestTimeoutMs: 5_000 })

    clientIn.on('data', (chunk) => {
      const lines = chunk.toString('utf8').split('\n').filter(Boolean)
      for (const line of lines) {
        const msg = JSON.parse(line) as { id: number; method: string }
        if (msg.method === 'initialize') {
          agentOut.write(
            encodeJsonRpcMessage({
              jsonrpc: '2.0',
              id: msg.id,
              result: {
                protocolVersion: 1,
                agentCapabilities: {},
                agentInfo: { name: 'mock-agent', version: '0.0.1' },
                authMethods: [],
              },
            }),
          )
        }
        if (msg.method === 'session/new') {
          agentOut.write(
            encodeJsonRpcMessage({
              jsonrpc: '2.0',
              id: msg.id,
              result: { sessionId: 'sess_test_1' },
            }),
          )
        }
      }
    })

    const init = (await transport.request('initialize', {
      protocolVersion: 1,
      clientCapabilities: {},
    })) as { protocolVersion: number; agentInfo: { name: string } }
    expect(init.protocolVersion).toBe(1)
    expect(init.agentInfo.name).toBe('mock-agent')

    const session = (await transport.request('session/new', {
      cwd: '/tmp',
      mcpServers: [],
    })) as { sessionId: string }
    expect(session.sessionId).toBe('sess_test_1')

    transport.dispose()
  })
})
