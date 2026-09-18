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

describe('MCP read-only annotations and concurrency', () => {
  it('tools/list marks read-only tools as safe/idempotent hints', async () => {
    const response = (await handleInkdownMcpRpc(
      { jsonrpc: '2.0', id: 3, method: 'tools/list' },
      context(),
    )) as {
      result: {
        tools: Array<{
          name: string
          annotations?: Record<string, unknown>
        }>
      }
    }
    const read = response.result.tools.find((tool) => tool.name === 'inkdown_read')
    const inspect = response.result.tools.find((tool) => tool.name === 'inkdown_inspect_content')
    const propose = response.result.tools.find((tool) => tool.name === 'inkdown_propose_mark')
    expect(read?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    })
    expect(inspect?.annotations).toMatchObject({ readOnlyHint: true })
    expect(propose?.annotations).toMatchObject({ readOnlyHint: false })

    const diagram = response.result.tools.find((tool) => tool.name === 'inkdown_generate_diagram')
    const crossRef = response.result.tools.find((tool) => tool.name === 'inkdown_cross_reference')
    expect(diagram?.annotations).toMatchObject({ readOnlyHint: true, idempotentHint: true })
    expect(crossRef?.annotations).toMatchObject({ readOnlyHint: true, idempotentHint: true })
  })

  it('inkdown_generate_diagram 校验入参并清洗 ```mermaid 标记', async () => {
    const invalidType = await callInkdownMcpTool(
      'inkdown_generate_diagram',
      context(),
      { diagramType: 'invalid', title: 'Test', mermaidCode: 'graph TD; A-->B;' },
    )
    expect(invalidType.isError).toBe(true)

    const missingTitle = await callInkdownMcpTool(
      'inkdown_generate_diagram',
      context(),
      { diagramType: 'sequence', title: '', mermaidCode: 'Alice->Bob: Hi' },
    )
    expect(missingTitle.isError).toBe(true)

    const valid = await callInkdownMcpTool(
      'inkdown_generate_diagram',
      context(),
      {
        diagramType: 'sequence',
        title: 'ACP 握手时序',
        mermaidCode: '```mermaid\nsequenceDiagram\nClient->>Agent: init\nAgent-->>Client: ack\n```',
        anchorExcerpt: 'Clients MUST initialize the connection',
        summary: '这是协议初始握手过程',
        visualSteps: [
          {
            from: 'client',
            to: 'agent',
            action: 'initialize',
            desc: '发起握手',
            payload: '{ protocolVersion: 1 }',
          },
        ],
      },
    )
    expect(valid.isError).toBeUndefined()
    const parsed = JSON.parse(valid.content[0]!.text)
    expect(parsed.diagramType).toBe('sequence')
    expect(parsed.title).toBe('ACP 握手时序')
    expect(parsed.mermaidCode).toBe('sequenceDiagram\nClient->>Agent: init\nAgent-->>Client: ack')
    expect(parsed.anchorExcerpt).toBe('Clients MUST initialize the connection')
    expect(parsed.summary).toBe('这是协议初始握手过程')
    expect(parsed.visualSteps).toHaveLength(1)
    expect(parsed.visualSteps[0].action).toBe('initialize')
    expect(parsed.diagramId).toMatch(/^diag-/)
  })

  it('inkdown_cross_reference 跨章节聚合检索命中', async () => {
    const tooShort = await callInkdownMcpTool(
      'inkdown_cross_reference',
      context(),
      { entityName: 'a' },
    )
    expect(tooShort.isError).toBe(true)

    const readSnapshot = vi.fn(async () =>
      JSON.stringify({
        query: 'protocolVersion',
        totalMatches: 5,
        hits: [
          { title: 'Chapter 1', flatIndex: 0, count: 2, snippet: 'negotiate protocolVersion' },
          { title: 'Chapter 2', flatIndex: 1, count: 3, snippet: 'latest protocolVersion supported' },
        ],
      }),
    )

    const valid = await callInkdownMcpTool(
      'inkdown_cross_reference',
      context(readSnapshot),
      { entityName: 'protocolVersion' },
    )
    expect(readSnapshot).toHaveBeenCalledWith('search', { query: 'protocolVersion' })
    expect(valid.isError).toBeUndefined()
    const parsed = JSON.parse(valid.content[0]!.text)
    expect(parsed.entity).toBe('protocolVersion')
    expect(parsed.totalOccurrences).toBe(5)
    expect(parsed.chapterDistribution).toHaveLength(2)
    expect(parsed.chapterDistribution[0]).toEqual({
      chapter: 'Chapter 1',
      flatIndex: 0,
      occurrences: 2,
      excerpt: 'negotiate protocolVersion',
    })
  })

  it('independent read-only calls execute concurrently when the client sends them concurrently', async () => {
    let active = 0
    let maxActive = 0
    const readSnapshot = vi.fn(async () => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 10))
      active -= 1
      return '{}'
    })

    await Promise.all([
      callInkdownMcpTool('inkdown_read', context(readSnapshot), { scope: 'viewport' }),
      callInkdownMcpTool('inkdown_read', context(readSnapshot), { scope: 'toc' }),
      callInkdownMcpTool('inkdown_get_selection', context(readSnapshot)),
    ])

    expect(maxActive).toBe(3)
  })
})
