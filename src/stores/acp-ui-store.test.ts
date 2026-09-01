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

  it('setSession(null) keeps thread.agentSessionId for reconnect', () => {
    useAcpUiStore.getState().setSession('sess-keep-me')
    const threadId = useAcpUiStore.getState().activeThreadId
    expect(
      useAcpUiStore.getState().threads.find((t) => t.id === threadId)?.agentSessionId,
    ).toBe('sess-keep-me')
    useAcpUiStore.getState().setSession(null)
    const state = useAcpUiStore.getState()
    expect(state.sessionId).toBeNull()
    expect(state.threads.find((t) => t.id === threadId)?.agentSessionId).toBe('sess-keep-me')
  })

  it('ingestPermissionRequest surfaces pending + tool card for approval UI', () => {
    useAcpUiStore.getState().ingestPermissionRequest({
      requestId: 42,
      summary: 'Delete demo.md',
      toolCallId: 'tc-del',
      options: [
        { optionId: 'allow-once', name: '允许', kind: 'allow_once' },
        { optionId: 'reject-once', name: '拒绝', kind: 'reject_once' },
      ],
      toolCall: {
        toolCallId: 'tc-del',
        title: 'Delete demo.md',
        kind: 'delete',
        status: 'pending',
      },
    })

    const state = useAcpUiStore.getState()
    expect(state.pendingPermission?.requestId).toBe(42)
    expect(state.pendingPermission?.toolCallId).toBe('tc-del')
    const tool = state.threads
      .find((t) => t.id === state.activeThreadId)
      ?.messages.find((m) => m.role === 'tool' && m.toolCallId === 'tc-del')
    expect(tool?.toolTitle).toBe('Delete demo.md')
    expect(tool?.toolStatus).toBe('pending')
    expect(tool?.streaming).toBe(true)

    useAcpUiStore.getState().clearPendingPermission(42)
    expect(useAcpUiStore.getState().pendingPermission).toBeNull()
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

  it('createThread drops the previous blank draft', () => {
    const first = useAcpUiStore.getState().activeThreadId
    const second = useAcpUiStore.getState().createThread()
    expect(useAcpUiStore.getState().threads.some((t) => t.id === first)).toBe(false)
    expect(useAcpUiStore.getState().activeThreadId).toBe(second)
    expect(useAcpUiStore.getState().threads).toHaveLength(1)
  })

  it('opening panel keeps the active conversation instead of a blank draft', () => {
    useAcpUiStore.getState().appendUserMessage('旧会话')
    const oldId = useAcpUiStore.getState().activeThreadId
    useAcpUiStore.getState().setPanelOpen(false)
    useAcpUiStore.getState().setPanelOpen(true)
    const state = useAcpUiStore.getState()
    expect(state.panelOpen).toBe(true)
    expect(state.activeThreadId).toBe(oldId)
    expect(state.threads.find((t) => t.id === oldId)?.messages[0]?.text).toBe('旧会话')
  })

  it('closing panel prunes blank drafts', () => {
    useAcpUiStore.getState().appendUserMessage('保留')
    useAcpUiStore.getState().createThread()
    expect(useAcpUiStore.getState().threads.length).toBeGreaterThanOrEqual(2)
    useAcpUiStore.getState().setPanelOpen(false)
    const state = useAcpUiStore.getState()
    expect(state.panelOpen).toBe(false)
    expect(state.threads.every((t) => t.messages.some((m) => m.role === 'user'))).toBe(
      true,
    )
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

  it('finishStreaming prunes intermediate agent replies in the current turn', () => {
    useAcpUiStore.getState().appendUserMessage('retry please')
    useAcpUiStore.getState().applySessionUpdate({
      sessionUpdate: 'agent_thought_chunk',
      content: { type: 'text', text: 'plan' },
    })
    useAcpUiStore.setState((s) => {
      const thread = s.threads.find((t) => t.id === s.activeThreadId)
      if (!thread) return s
      const messages = [
        ...thread.messages,
        {
          id: 'a-mid',
          role: 'agent' as const,
          text: '中间进度：准备重试',
          createdAt: Date.now(),
          streaming: false,
        },
        {
          id: 'a-final',
          role: 'agent' as const,
          text: '最终结果：已完成',
          createdAt: Date.now(),
          streaming: true,
        },
      ]
      return {
        threads: s.threads.map((t) =>
          t.id === s.activeThreadId ? { ...t, messages } : t,
        ),
      }
    })

    useAcpUiStore.getState().finishStreaming()
    const messages =
      useAcpUiStore.getState().threads.find(
        (t) => t.id === useAcpUiStore.getState().activeThreadId,
      )?.messages ?? []
    const agents = messages.filter((m) => m.role === 'agent')
    expect(agents).toHaveLength(1)
    expect(agents[0]?.text).toBe('最终结果：已完成')
    expect(agents[0]?.streaming).toBe(false)
    expect(messages.some((m) => m.role === 'thought')).toBe(true)
  })

  it('rememberConfigPreference persists per runtime', () => {
    useAcpUiStore.getState().rememberConfigPreference('codex-acp', 'mode', 'ask-for-approval')
    useAcpUiStore.getState().rememberConfigPreference('codex-acp', 'model', 'gpt-x')
    expect(useAcpUiStore.getState().preferredConfigByRuntime['codex-acp']).toEqual({
      mode: 'ask-for-approval',
      model: 'gpt-x',
    })
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
