import { beforeEach, describe, expect, it } from 'vitest'
import {
  annotationFileKey,
  annotationOwnsSessionId,
  useAnnotationAgentStore,
} from '@/stores/annotation-agent-store'

describe('annotation-agent-store', () => {
  beforeEach(() => {
    useAnnotationAgentStore.setState({
      byFileKey: {},
      activeFileKey: null,
      pendingDraft: null,
      phase: 'idle',
      capturing: false,
      prompting: false,
      timelineOpen: false,
      externalProposeOpen: false,
      proposeHost: null,
      sessionsStale: false,
    })
  })

  it('同 fileKey 优先复用线程，新会话换 active', () => {
    const key = annotationFileKey('abc', '/books/a.pdf')
    useAnnotationAgentStore.getState().ensureFile(key)
    const first = useAnnotationAgentStore.getState().byFileKey[key]!.activeThreadId
    useAnnotationAgentStore.getState().ensureFile(key)
    expect(useAnnotationAgentStore.getState().byFileKey[key]!.activeThreadId).toBe(first)

    const second = useAnnotationAgentStore.getState().createThread(key)
    expect(second).not.toBe(first)
    expect(useAnnotationAgentStore.getState().byFileKey[key]!.activeThreadId).toBe(second)
  })

  it('不同 fileKey 互不干扰', () => {
    const a = annotationFileKey('a', '/a')
    const b = annotationFileKey('b', '/b')
    useAnnotationAgentStore.getState().ensureFile(a)
    useAnnotationAgentStore.getState().appendUserMessage('关于 A')
    useAnnotationAgentStore.getState().ensureFile(b)
    expect(useAnnotationAgentStore.getState().lastAgentText()).toBe('')
    useAnnotationAgentStore.getState().ensureFile(a)
    const messages =
      useAnnotationAgentStore.getState().byFileKey[a]!.threads[0]!.messages
    expect(messages.some((m) => m.text === '关于 A')).toBe(true)
  })

  it('pendingDraft 丢弃不残留 externalProposeOpen', () => {
    useAnnotationAgentStore.getState().setPendingDraft({
      fileKey: 'fp:x',
      excerpt: '摘录',
      note: '草稿',
      source: 'ai',
    })
    useAnnotationAgentStore.getState().setExternalProposeOpen(true)
    useAnnotationAgentStore.getState().discardDraft()
    expect(useAnnotationAgentStore.getState().pendingDraft).toBeNull()
    expect(useAnnotationAgentStore.getState().externalProposeOpen).toBe(false)
  })

  it('annotationOwnsSessionId 只认批注线程绑定的 session', () => {
    const key = annotationFileKey('s', '/s.epub')
    useAnnotationAgentStore.getState().ensureFile(key)
    useAnnotationAgentStore.getState().bindSessionId('ann-sess-1')
    expect(
      annotationOwnsSessionId(useAnnotationAgentStore.getState(), 'ann-sess-1'),
    ).toBe(true)
    expect(
      annotationOwnsSessionId(useAnnotationAgentStore.getState(), 'main-sess'),
    ).toBe(false)
  })

  it('clearAllAgentSessionIds 清绑定但保留本地消息', () => {
    const key = annotationFileKey('c', '/c.epub')
    useAnnotationAgentStore.getState().ensureFile(key)
    useAnnotationAgentStore.getState().bindSessionId('ann-x')
    useAnnotationAgentStore.getState().appendUserMessage('留下')
    useAnnotationAgentStore.getState().clearAllAgentSessionIds()
    const thread = useAnnotationAgentStore.getState().byFileKey[key]!.threads[0]!
    expect(thread.agentSessionId).toBeNull()
    expect(thread.messages.some((m) => m.text === '留下')).toBe(true)
  })

  it('markSessionsStale 保留 agentSessionId 供重连 load', () => {
    const key = annotationFileKey('r', '/r.epub')
    useAnnotationAgentStore.getState().ensureFile(key)
    useAnnotationAgentStore.getState().bindSessionId('ann-resume')
    useAnnotationAgentStore.getState().markSessionsStale()
    expect(useAnnotationAgentStore.getState().sessionsStale).toBe(true)
    expect(
      useAnnotationAgentStore.getState().byFileKey[key]!.threads[0]!.agentSessionId,
    ).toBe('ann-resume')
    useAnnotationAgentStore.getState().clearSessionsStale()
    expect(useAnnotationAgentStore.getState().sessionsStale).toBe(false)
  })
})
