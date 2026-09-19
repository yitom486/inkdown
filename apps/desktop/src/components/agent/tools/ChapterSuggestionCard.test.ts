// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ChapterSuggestionCard,
  type SuggestChaptersPayload,
} from './ChapterSuggestionCard'

;(globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('ChapterSuggestionCard', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('renders suggested chapters with title, relevance, and reason', async () => {
    const payload: SuggestChaptersPayload = {
      chapters: [
        {
          flatIndex: 2,
          title: '第二章 会话生命周期与协议状态机',
          reason: '涵盖连接初始化与错误重试策略',
          relevanceScore: 92,
        },
        {
          flatIndex: 5,
          title: '第五章 权限沙箱与安全隔离',
          reason: '深入分析只读与写操作防护',
          relevanceScore: 85,
        },
      ],
    }

    await act(async () => {
      root.render(createElement(ChapterSuggestionCard, { payload }))
    })

    expect(container.textContent).toContain('智能导读与续读推荐')
    expect(container.textContent).toContain('共推荐 2 处研读章节')
    expect(container.textContent).toContain('第二章 会话生命周期与协议状态机')
    expect(container.textContent).toContain('92% 契合')
    expect(container.textContent).toContain('第五章 权限沙箱与安全隔离')
  })

  it('calls onSelectChapter when clicking研读该章', async () => {
    const onSelectChapter = vi.fn()
    const payload: SuggestChaptersPayload = {
      chapters: [
        {
          flatIndex: 3,
          title: '第三章 架构流转',
          reason: '核心概念',
          relevanceScore: 90,
        },
      ],
    }

    await act(async () => {
      root.render(createElement(ChapterSuggestionCard, { payload, onSelectChapter }))
    })

    const buttons = Array.from(container.querySelectorAll('button'))
    const selectBtn = buttons.find((b) => b.textContent?.includes('研读该章'))
    expect(selectBtn).toBeDefined()

    await act(async () => {
      selectBtn?.click()
    })

    expect(onSelectChapter).toHaveBeenCalledWith(payload.chapters[0])
    expect(container.textContent).toContain('已前往')
  })
})
