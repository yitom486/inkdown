import { describe, expect, it, vi } from 'vitest'
import { handleInkdownMcpRpc } from './inkdown-mcp-rpc'
import { callInkdownMcpTool, INKDOWN_MCP_TOOLS } from './inkdown-mcp-tools'

function context(readSnapshot = vi.fn(async () => '{"total":0,"hits":[]}')) {
  return { readSnapshot }
}

describe('inkdown_inspect_content schema', () => {
  it('tools/list 暴露新工具且 schema 严格（无指纹/路径/SQL 参数）', async () => {
    const response = (await handleInkdownMcpRpc(
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      context(),
    )) as { result: { tools: Array<{ name: string; inputSchema: Record<string, unknown> }> } }
    const tool = response.result.tools.find((t) => t.name === 'inkdown_inspect_content')
    expect(tool).toBeDefined()
    expect(tool?.inputSchema).toMatchObject({ required: ['query'], additionalProperties: false })
    const props = (tool?.inputSchema as { properties: Record<string, unknown> }).properties
    expect(Object.keys(props).sort()).toEqual(['limit', 'query'])
  })

  it('P3.1 描述覆盖三来源且 schema 仍只有 query/limit', async () => {
    const response = (await handleInkdownMcpRpc(
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      context(),
    )) as { result: { tools: Array<{ name: string; description: string }> } }
    const tool = response.result.tools.find((t) => t.name === 'inkdown_inspect_content')
    expect(tool?.description).toContain('EPUB/MOBI')
    expect(tool?.description).not.toContain('只针对当前打开且已入库的 PDF')
  })
})

describe('inkdown_inspect_content 参数校验与隔离', () => {
  it('空 query 直接报错，不碰快照', async () => {
    const readSnapshot = vi.fn(async () => '')
    const result = await callInkdownMcpTool(
      'inkdown_inspect_content',
      context(readSnapshot),
      { query: '  ' },
    )
    expect(result.isError).toBe(true)
    expect(readSnapshot).not.toHaveBeenCalled()
  })

  it('非数字 limit 直接报错', async () => {
    const result = await callInkdownMcpTool('inkdown_inspect_content', context(), {
      query: '王道计',
      limit: '10',
    })
    expect(result.isError).toBe(true)
  })

  it('模型附带的指纹/路径/SQL 一律丢弃，只透传 query/limit', async () => {
    const readSnapshot = vi.fn(async () => '{"total":0,"hits":[]}')
    await callInkdownMcpTool('inkdown_inspect_content', context(readSnapshot), {
      query: '王道计',
      limit: 5,
      fingerprint: 'evil-fp',
      filePath: '/etc/passwd',
      sql: 'SELECT * FROM blocks',
    })
    expect(readSnapshot).toHaveBeenCalledTimes(1)
    expect(readSnapshot).toHaveBeenCalledWith('content-audit', { query: '王道计', limit: 5 })
  })

  it('快照失败向上传递，由 RPC 层转为 isError（不冒充空结果）', async () => {
    const readSnapshot = vi.fn(async () => {
      throw new Error('本书尚未导入罗盘索引')
    })
    const response = (await handleInkdownMcpRpc(
      {
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: { name: 'inkdown_inspect_content', arguments: { query: '王道计' } },
      },
      context(readSnapshot),
    )) as { result: { isError: boolean; content: Array<{ text: string }> } }
    expect(response.result.isError).toBe(true)
    expect(response.result.content[0]?.text).toContain('尚未导入罗盘索引')
  })
})

describe('inkdown_read 回归', () => {
  it('scope=search 行为不变', async () => {
    const readSnapshot = vi.fn(async () => '{"hits":[]}')
    const result = await callInkdownMcpTool('inkdown_read', context(readSnapshot), {
      scope: 'search',
      query: '王道计',
    })
    expect(result.isError).toBeFalsy()
    expect(readSnapshot).toHaveBeenCalledWith('search', { query: '王道计' })
  })
})
