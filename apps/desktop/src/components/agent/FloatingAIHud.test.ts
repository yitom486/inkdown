// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FloatingAIHud, collectRfcHits, deriveTocProposals } from './FloatingAIHud'
import { useAcpUiStore } from '@/stores/acp-ui-store'
import { useReaderHudUiStore } from '@/stores/acp/reader-hud-store'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

;(globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

// Mock AgentPanel to keep test isolated
vi.mock('@/components/agent/AgentPanel', () => ({
  AgentPanel: () => createElement('div', { 'data-testid': 'mock-agent-panel' }, 'MockAgentPanel'),
}))

// Mock readingMarksApi
vi.mock('@/api/reading-marks-api', () => ({
  readingMarksApi: {
    list: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    create: vi.fn().mockResolvedValue({ ok: true, value: { id: 'mock-1' } }),
    update: vi.fn().mockResolvedValue({ ok: true, value: { id: 'mock-1' } }),
    remove: vi.fn().mockResolvedValue({ ok: true }),
  },
}))

describe('FloatingAIHud', () => {
  let container: HTMLDivElement
  let root: Root
  let queryClient: QueryClient

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    // 默认恢复状态
    useAcpUiStore.setState({
      panelOpen: true,
      hudDisplayMode: 'floating',
      status: 'connected',
      selectedRuntimeId: 'codex-acp',
    })
    useReaderHudUiStore.setState({
      hudActiveTab: 'chat',
      floatingPosition: { x: 100, y: 100 },
    })
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    queryClient.clear()
  })

  it('renders null when in docked mode', async () => {
    useAcpUiStore.setState({ hudDisplayMode: 'docked' })

    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(FloatingAIHud, { workspaceRoot: '/workspace' })
        )
      )
    })

    expect(container.querySelector('[data-testid="floating-ai-hud"]')).toBeNull()
    expect(container.querySelector('[data-testid="ai-hud-capsule"]')).toBeNull()
  })

  it('renders capsule pill when in capsule mode', async () => {
    useAcpUiStore.setState({ hudDisplayMode: 'capsule' })

    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(FloatingAIHud, { workspaceRoot: '/workspace' })
        )
      )
    })

    const capsule = container.querySelector('[data-testid="ai-hud-capsule"]')
    expect(capsule).not.toBeNull()
    expect(capsule?.textContent).toContain('HUD')
  })

  it('renders 4 tabs in floating mode and can switch to cards and summary', async () => {
    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(FloatingAIHud, {
            workspaceRoot: '/workspace',
            activeFilePath: '/books/test.epub',
          })
        )
      )
    })

    const floatingHud = container.querySelector('[data-testid="floating-ai-hud"]')
    expect(floatingHud).not.toBeNull()
    expect(container.textContent).toContain('对话')
    expect(container.textContent).toContain('卡片')
    expect(container.textContent).toContain('摘要')
    expect(container.textContent).toContain('大纲')

    // 切换到 summary
    await act(async () => {
      useReaderHudUiStore.getState().setHudActiveTab('summary')
    })

    expect(container.textContent).toContain('智能研读纵深分析')
    expect(container.textContent).toContain('强制规约')
    // 写死 mock 已清扫：无规约卡片、无关键词云假数据，留空态
    expect(container.textContent).toContain('暂未命中规约约束条目')
    expect(container.textContent).toContain('暂无批注要点')
    expect(container.textContent).not.toContain('MCP 协议')
  })

  it('outline shows empty toc state instead of hardcoded proposals', async () => {    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(FloatingAIHud, {
            workspaceRoot: '/workspace',
            activeFilePath: '/books/test.epub',
          })
        )
      )
    })

    await act(async () => {
      useReaderHudUiStore.getState().setHudActiveTab('outline')
    })

    expect(container.textContent).toContain('暂无编目提案')
    expect(container.textContent).not.toContain('核心状态机生命周期流转拓扑')
    expect(container.textContent).not.toContain('双向能力协商与异常熔断机制')
  })
})

describe('collectRfcHits', () => {
  it('extracts quotes with context and caps per level', () => {
    const text = '首段必须遵守规范。第二段应当谨慎。第三段必须复核。可选步骤允许跳过。'
    const hits = collectRfcHits(text, 2, 4)
    expect(hits.filter((h) => h.level === 'MUST')).toHaveLength(2)
    expect(hits.filter((h) => h.level === 'SHOULD')).toHaveLength(1)
    expect(hits.filter((h) => h.level === 'MAY')).toHaveLength(2)
    expect(hits[0].quote).toBe('必须')
    expect(hits[0].context).toContain('必须')
  })

  it('returns empty when nothing matches', () => {
    expect(collectRfcHits('今天天气不错，适合读书。')).toEqual([])
  })
})

describe('deriveTocProposals', () => {
  it('parses toc_upsert_entry tool calls with status mapping', () => {
    const views = deriveTocProposals([
      {
        id: 'm1',
        role: 'tool',
        toolTitle: 'Update TOC entry',
        toolContentText: JSON.stringify({
          entry: { title: '新章', printedPage: 42, level: 1 },
          fingerprint: 'fp',
        }),
        toolStatus: 'completed',
        toolCallId: 'tc-1',
      },
      {
        id: 'm2',
        role: 'tool',
        toolTitle: 'Update TOC entry',
        toolContentText: JSON.stringify({ entry: { title: '待定', level: 2 } }),
        toolStatus: 'pending',
      },
      { id: 'm3', role: 'agent', toolTitle: '', toolContentText: 'hello' },
      {
        id: 'm4',
        role: 'tool',
        toolTitle: 'read file',
        toolContentText: '{"entry":{"title":"unrelated"}}',
        toolStatus: 'completed',
      },
    ])
    // m4 标题与内容前 200 字均无 toc 标记：即使有 entry 结构也应跳过
    expect(views.map((v) => v.proposedTitle)).toEqual(['新章', '待定'])
    expect(views[0]).toMatchObject({
      id: 'tc-1',
      type: 'add',
      targetChapter: '第 42 页',
      status: 'accepted',
    })
    expect(views[1]).toMatchObject({ targetChapter: '层级 2', status: 'pending' })
  })

  it('skips entries without title and broken json', () => {
    expect(
      deriveTocProposals([
        { id: 'a', role: 'tool', toolTitle: 'toc_upsert_entry', toolContentText: 'not json' },
        {
          id: 'b',
          role: 'tool',
          toolTitle: 'toc_upsert_entry',
          toolContentText: JSON.stringify({ entry: { printedPage: 3 } }),
          toolStatus: 'failed',
        },
      ]),
    ).toEqual([])
  })
})

describe('悬浮窗拉伸', () => {
  let container: HTMLDivElement
  let root: Root
  let queryClient: QueryClient

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    useAcpUiStore.setState({
      panelOpen: true,
      hudDisplayMode: 'floating',
      status: 'connected',
      selectedRuntimeId: 'codex-acp',
    })
    useReaderHudUiStore.setState({
      hudActiveTab: 'chat',
      floatingPosition: { x: 100, y: 100 },
    })
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    queryClient.clear()
  })

    async function renderFloating() {
      useReaderHudUiStore.setState({
        hudDisplayMode: 'floating',
        panelOpen: true,
        floatingSize: { width: 450, height: 580 },
      })
      await act(async () => {
        root.render(
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(FloatingAIHud, { workspaceRoot: '/workspace' }),
          ),
        )
      })
    }

    function dragHandleBy(dx: number, dy: number) {
      const handle = container.querySelector('[data-testid="hud-resize-handle"]') as HTMLElement
      expect(handle).not.toBeNull()
      act(() => {
        handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }))
      })
      act(() => {
        window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: dx, clientY: dy }))
      })
      act(() => {
        window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      })
    }

    it('右下角手柄拖拽改宽高并写入 store', async () => {
      await renderFloating()
      dragHandleBy(60, 40)
      expect(useReaderHudUiStore.getState().floatingSize).toEqual({ width: 510, height: 620 })
      const hud = container.querySelector('[data-testid="floating-ai-hud"]') as HTMLElement
      expect(hud.style.width).toBe('510px')
      expect(hud.style.height).toBe('620px')
    })

    it('尺寸钳制在视口内与最小值', async () => {
      await renderFloating()
      // 超大拖拽：钳制到视口
      dragHandleBy(10000, 10000)
      const size = useReaderHudUiStore.getState().floatingSize
      expect(size.width).toBeLessThanOrEqual(window.innerWidth - 32)
      expect(size.height).toBeLessThanOrEqual(window.innerHeight - 72)
      // 反向拖拽：钳制到最小值
      dragHandleBy(-10000, -10000)
      expect(useReaderHudUiStore.getState().floatingSize).toEqual({ width: 320, height: 420 })
    })
})