import { describe, expect, it, vi } from 'vitest'
import {
  handleInkdownMcpRpc,
  type McpRpcMessage,
} from './inkdown-mcp-rpc'
import {
  callInkdownTocTool,
  INKDOWN_TOC_MCP_TOOLS,
} from './inkdown-mcp-toc-tools'
import type { InkdownMcpToolContext } from './inkdown-mcp-tools'

function stubContext(reply: string): InkdownMcpToolContext {
  return {
    readSnapshot: async () => reply,
  }
}

function callMessage(name: string, args?: Record<string, unknown>): McpRpcMessage {
  return { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }
}

describe('toc mcp tools', () => {
  it('tools/list 只暴露目录工具（主表不可见）', async () => {
    const response = (await handleInkdownMcpRpc(
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      stubContext(''),
      INKDOWN_TOC_MCP_TOOLS,
      callInkdownTocTool,
    )) as { result: { tools: Array<{ name: string }> } }
    const names = response.result.tools.map((t) => t.name).sort()
    expect(names).toEqual(['toc_delete_entry', 'toc_list_draft', 'toc_replace_all', 'toc_upsert_entry'])
    expect(names.some((n) => n.startsWith('inkdown_'))).toBe(false)
  })

  it('子表外的工具名被拒（即使主表里有）', async () => {
    const response = (await handleInkdownMcpRpc(
      callMessage('inkdown_read', { scope: 'toc' }),
      stubContext(''),
      INKDOWN_TOC_MCP_TOOLS,
      callInkdownTocTool,
    )) as { result: { content: Array<{ text: string }>; isError?: boolean } }
    expect(response.result.isError).toBe(true)
    expect(response.result.content[0]?.text).toContain('未知目录工具')
  })

  it('写工具缺指纹直接失败，不碰快照', async () => {
    let snapshotCalls = 0
    const result = await callInkdownTocTool(
      'toc_replace_all',
      { readSnapshot: async () => { snapshotCalls += 1; return '' } },
      { entries: [] },
    )
    expect(result.isError).toBe(true)
    expect(snapshotCalls).toBe(0)
  })

  it('replace 转发 op 并回传后端确认', async () => {
    let seenResource = ''
    const result = await callInkdownTocTool(
      'toc_replace_all',
      {
        readSnapshot: async (resource) => {
          seenResource = resource
          return '{"ok":true,"op":"replace","count":12,"dropped":1}'
        },
      },
      { fingerprint: 'fp-1', entries: [{ title: '第1章', printedPage: 1, level: 1 }] },
    )
    expect(result.isError).toBeFalsy()
    expect(seenResource).toBe('toc-draft-write')
    expect(result.content[0]?.text).toContain('"count":12')
  })

  it('未知工具名报错', async () => {
    const result = await callInkdownTocTool('toc_nope', stubContext(''), {})
    expect(result.isError).toBe(true)
  })

  it('诊断日志只带指纹尾，不带完整路径', async () => {
    const lines: string[] = []
    const spy = vi.spyOn(console, 'info').mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(' '))
    })
    try {
      await callInkdownTocTool('toc_list_draft', stubContext('{}'), {
        fingerprint: 'D:\\book\\secret-dir\\wangdao.pdf|208761996',
      })
    } finally {
      spy.mockRestore()
    }
    const logged = lines.filter((line) => line.includes('[toc-mcp]'))
    expect(logged.length).toBeGreaterThan(0)
    for (const line of logged) {
      expect(line).not.toContain('secret-dir')
      expect(line).not.toContain('D:\\book')
    }
    expect(logged.some((line) => line.includes('wangdao.pdf|208761996'))).toBe(true)
    expect(logged.some((line) => /elapsedMs=\d+/.test(line))).toBe(true)
  })
})
