// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { useAcpUiStore } from '@/stores/acp-ui-store'

describe('acp-ui-store history + plan', () => {
  beforeEach(() => {
    const fresh = useAcpUiStore.getState().createThread()
    useAcpUiStore.setState({
      prompting: false,
      sessionId: null,
      status: 'disconnected',
    })
    // 只保留刚建的空线程，避免持久化干扰
    const thread = useAcpUiStore.getState().threads.find((t) => t.id === fresh)
    useAcpUiStore.setState({
      threads: thread ? [thread] : useAcpUiStore.getState().threads.slice(0, 1),
      activeThreadId: fresh,
    })
  })

  it('createThread switches to empty conversation', () => {
    useAcpUiStore.getState().appendUserMessage('hello')
    const id = useAcpUiStore.getState().createThread()
    const state = useAcpUiStore.getState()
    expect(state.activeThreadId).toBe(id)
    const active = state.threads.find((t) => t.id === id)
    expect(active?.messages).toEqual([])
    expect(state.threads.length).toBeGreaterThanOrEqual(2)
  })

  it('switchThread restores prior messages', () => {
    useAcpUiStore.getState().appendUserMessage('first thread')
    const firstId = useAcpUiStore.getState().activeThreadId
    const secondId = useAcpUiStore.getState().createThread()
    useAcpUiStore.getState().appendUserMessage('second thread')
    useAcpUiStore.getState().switchThread(firstId)
    const state = useAcpUiStore.getState()
    expect(state.activeThreadId).toBe(firstId)
    expect(state.threads.find((t) => t.id === firstId)?.messages[0]?.text).toBe('first thread')
    expect(state.threads.find((t) => t.id === secondId)?.messages[0]?.text).toBe('second thread')
  })

  it('applies plan sessionUpdate and replaces entries', () => {
    useAcpUiStore.getState().applySessionUpdate({
      sessionUpdate: 'plan',
      entries: [
        { content: 'A', status: 'pending' },
        { content: 'B', status: 'in_progress' },
      ],
    })
    let messages =
      useAcpUiStore.getState().threads.find(
        (t) => t.id === useAcpUiStore.getState().activeThreadId,
      )?.messages ?? []
    expect(messages.some((m) => m.role === 'plan')).toBe(true)
    expect(messages.find((m) => m.role === 'plan')?.planEntries).toHaveLength(2)

    useAcpUiStore.getState().applySessionUpdate({
      sessionUpdate: 'plan_update',
      plan: {
        entries: [{ content: 'A', status: 'completed' }],
      },
    })
    messages =
      useAcpUiStore.getState().threads.find(
        (t) => t.id === useAcpUiStore.getState().activeThreadId,
      )?.messages ?? []
    const plan = messages.find((m) => m.role === 'plan')
    expect(plan?.planEntries).toEqual([
      { content: 'A', priority: undefined, status: 'completed' },
    ])
    expect(plan?.streaming).toBe(false)
  })
})
