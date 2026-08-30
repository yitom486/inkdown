import { describe, expect, it, vi } from 'vitest'
import { handleInkdownMcpRpc } from './inkdown-mcp-rpc'

function context(readSnapshot = vi.fn(async () => '{"entries":[]}')) {
  return { readSnapshot }
}

describe('handleInkdownMcpRpc', () => {
  it('initialize 回声客户端协议版本', async () => {
    const response = await handleInkdownMcpRpc(
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2026-07-28' } },
      context(),
    )
    expect(response).toMatchObject({
      id: 1,
      result: { protocolVersion: '2026-07-28', serverInfo: { name: 'inkdown' } },
    })
  })

  it('客户端未给版本时用兜底版本', async () => {
    const response = (await handleInkdownMcpRpc(
      { jsonrpc: '2.0', id: 1, method: 'initialize' },
      context(),
    )) as { result: { protocolVersion: string } }
    expect(response.result.protocolVersion).toBe('2025-06-18')
  })

  it('tools/list 暴露 inkdown_get_toc', async () => {
    const response = (await handleInkdownMcpRpc(
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      context(),
    )) as { result: { tools: Array<{ name: string }> } }
    expect(response.result.tools.map((t) => t.name)).toContain('inkdown_get_toc')
  })

  it('tools/call 走快照回路', async () => {
    const readSnapshot = vi.fn(async () => '{"entries":[{"index":0}]}')
    const response = await handleInkdownMcpRpc(
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'inkdown_get_toc' } },
      context(readSnapshot),
    )
    expect(readSnapshot).toHaveBeenCalledWith('toc.json')
    expect(response).toMatchObject({
      id: 3,
      result: { content: [{ type: 'text', text: '{"entries":[{"index":0}]}' }] },
    })
  })

  it('快照失败回 isError 结果而非 RPC 错误，让模型能读到原因', async () => {
    const readSnapshot = vi.fn(async () => {
      throw new Error('没有可用窗口提供 Inkdown 快照')
    })
    const response = (await handleInkdownMcpRpc(
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'inkdown_get_toc' } },
      context(readSnapshot),
    )) as { result: { isError: boolean; content: Array<{ text: string }> } }
    expect(response.result.isError).toBe(true)
    expect(response.result.content[0]?.text).toContain('没有可用窗口')
  })

  it('未知工具回 isError', async () => {
    const response = (await handleInkdownMcpRpc(
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'nope' } },
      context(),
    )) as { result: { isError: boolean } }
    expect(response.result.isError).toBe(true)
  })

  it('通知返回 null，供 HTTP 层回 202', async () => {
    expect(
      await handleInkdownMcpRpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, context()),
    ).toBeNull()
  })

  it('未实现的方法回 -32601', async () => {
    expect(
      await handleInkdownMcpRpc({ jsonrpc: '2.0', id: 6, method: 'resources/list' }, context()),
    ).toMatchObject({ id: 6, error: { code: -32601 } })
  })
})
