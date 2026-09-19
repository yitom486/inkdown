// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FloatingAIHud } from './FloatingAIHud'
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
  })
})
