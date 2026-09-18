// @vitest-environment happy-dom
/**
 * ACP 运行时切换语义测试（跨 store 集成）。
 *
 * 目标：把「换 Agent（acp runtime）时，Agent 相关状态必须整体联动/隔离」的契约
 * 巩固成测试，防止后续实现回退：
 * 1. 断开/出错 → 瞬态状态清空（configOptions、promptCapabilities、待审批权限、prompting）
 * 2. sessionId 按运行时分桶 → 换 Agent 不串线、旧 Agent 恢复能力不丢
 * 3. 模型偏好按运行时隔离
 * 4. 本地聊天记录（threads/messages）跨运行时保留
 * 5. 旧版持久化（单值 agentSessionId）自动迁移到 codex 桶
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_ACP_RUNTIME_ID,
} from '@inkdown/contracts'
import {
  selectActiveThreadAgentSessionId,
  useAcpUiStore,
} from '@/stores/acp-ui-store'
import {
  annotationFileKey,
  annotationOwnsSessionId,
  useAnnotationAgentStore,
} from '@/stores/annotation-agent-store'

const CODEX = DEFAULT_ACP_RUNTIME_ID
const ANTIGRAVITY = 'antigravity-acp'

function freshMainThread(): void {
  const threadId = useAcpUiStore.getState().createThread()
  useAcpUiStore.setState({
    prompting: false,
    sessionId: null,
    status: 'disconnected',
    selectedRuntimeId: CODEX,
    pendingMarkProposalSnapshotContents: [],
  })
  const thread = useAcpUiStore.getState().threads.find((t) => t.id === threadId)
  useAcpUiStore.setState({
    threads: thread ? [thread] : useAcpUiStore.getState().threads,
    activeThreadId: threadId,
  })
}

describe('ACP 运行时切换：状态联动语义', () => {
  beforeEach(() => {
    localStorage.clear()
    freshMainThread()
    useAnnotationAgentStore.setState({
      byFileKey: {},
      activeFileKey: null,
      sessionsStale: false,
      capturing: false,
      prompting: false,
    })
  })

  it('断开/出错时瞬态状态全部清空，切运行时后依然干净', () => {
    useAcpUiStore.setState({
      status: 'connected',
      sessionId: 'sess-live',
      configOptions: [
        { configId: 'model', name: '模型', type: 'select', currentValue: 'gpt-5' },
      ],
      promptCapabilities: { image: true },
      prompting: true,
    })
    useAcpUiStore.getState().setPendingPermission({
      requestId: 1,
      summary: 'delete',
      options: [],
    })

    // 断开即清瞬态（真实流程：hook 收到 status 事件后先 setSession(null)）
    useAcpUiStore.getState().setStatus('disconnected')
    useAcpUiStore.getState().setSession(null)
    let state = useAcpUiStore.getState()
    expect(state.configOptions).toEqual([])
    expect(state.promptCapabilities).toEqual({})
    expect(state.pendingPermission).toBeNull()
    expect(state.prompting).toBe(false)
    expect(state.sessionId).toBeNull()

    // 换 Agent 后仍干净（不会被旧 Agent 残留污染）
    useAcpUiStore.getState().setSelectedRuntimeId(ANTIGRAVITY)
    state = useAcpUiStore.getState()
    expect(state.configOptions).toEqual([])
    expect(state.promptCapabilities).toEqual({})
    expect(state.pendingPermission).toBeNull()
  })

  it('错误状态同样清空模型列表与权限', () => {
    useAcpUiStore.setState({
      status: 'connected',
      configOptions: [{ configId: 'model', name: '模型', type: 'select' }],
    })
    useAcpUiStore.getState().setStatus('error', 'spawn failed')
    expect(useAcpUiStore.getState().configOptions).toEqual([])
    expect(useAcpUiStore.getState().pendingPermission).toBeNull()
  })

  it('sessionId 按运行时分桶：切 Agent 不串线，旧 Agent 恢复能力不丢', () => {
    // codex 连接 → 记入 codex 桶
    useAcpUiStore.getState().setSession('sess-codex-1', [])
    expect(selectActiveThreadAgentSessionId(useAcpUiStore.getState())).toBe('sess-codex-1')

    // 切到 antigravity：新运行时无旧会话 → resume 取不到 codex 的 id（不跨 Agent 串线）
    useAcpUiStore.getState().setSelectedRuntimeId(ANTIGRAVITY)
    useAcpUiStore.getState().setSession(null)
    expect(selectActiveThreadAgentSessionId(useAcpUiStore.getState())).toBeUndefined()

    // antigravity 连接 → 记入自己的桶，codex 桶不被覆盖
    useAcpUiStore.getState().setSession('sess-antigravity-1', [])
    const threadId = useAcpUiStore.getState().activeThreadId
    let thread = useAcpUiStore.getState().threads.find((t) => t.id === threadId)
    expect(thread?.agentSessionIds?.[ANTIGRAVITY]).toBe('sess-antigravity-1')
    expect(thread?.agentSessionIds?.[CODEX]).toBe('sess-codex-1')

    // 切回 codex：原会话仍可恢复
    useAcpUiStore.getState().setSelectedRuntimeId(CODEX)
    expect(selectActiveThreadAgentSessionId(useAcpUiStore.getState())).toBe('sess-codex-1')

    // 断开保留两侧恢复能力
    useAcpUiStore.getState().setSession(null)
    thread = useAcpUiStore
      .getState()
      .threads.find((t) => t.id === useAcpUiStore.getState().activeThreadId)
    expect(thread?.agentSessionIds?.[CODEX]).toBe('sess-codex-1')
    expect(thread?.agentSessionIds?.[ANTIGRAVITY]).toBe('sess-antigravity-1')
  })

  it('模型偏好按运行时隔离，互不污染', () => {
    useAcpUiStore.getState().rememberConfigPreference(CODEX, 'model', 'gpt-5')
    useAcpUiStore.getState().setSelectedRuntimeId(ANTIGRAVITY)
    useAcpUiStore.getState().rememberConfigPreference(ANTIGRAVITY, 'model', 'gemini-x')
    const prefs = useAcpUiStore.getState().preferredConfigByRuntime
    expect(prefs[CODEX]?.model).toBe('gpt-5')
    expect(prefs[ANTIGRAVITY]?.model).toBe('gemini-x')
    expect(prefs[ANTIGRAVITY]?.mode).toBeUndefined()
  })

  it('本地聊天记录跨运行时保留（换 Agent 不清历史）', () => {
    useAcpUiStore.getState().appendUserMessage('在 codex 下问的问题')
    useAcpUiStore.getState().setSelectedRuntimeId(ANTIGRAVITY)
    const messages =
      useAcpUiStore
        .getState()
        .threads.find((t) => t.id === useAcpUiStore.getState().activeThreadId)?.messages ?? []
    expect(messages.some((m) => m.text === '在 codex 下问的问题')).toBe(true)
  })

  it('旧版持久化自动迁移：单值 agentSessionId 归入 codex 桶', async () => {
    const threadId = 'thread_legacy'
    localStorage.setItem(
      'inkdown-acp-ui',
      JSON.stringify({
        state: {
          selectedRuntimeId: CODEX,
          activeThreadId: threadId,
          threads: [
            {
              id: threadId,
              title: '旧会话',
              createdAt: 1,
              updatedAt: 2,
              agentSessionId: 'sess-legacy-codex',
              messages: [
                { id: 'u1', role: 'user', text: '历史消息', createdAt: 3 },
              ],
            },
          ],
        },
        version: 0,
      }),
    )
    await useAcpUiStore.persist.rehydrate()
    const state = useAcpUiStore.getState()
    const thread = state.threads.find((t) => t.id === threadId)
    expect(thread?.agentSessionIds?.[CODEX]).toBe('sess-legacy-codex')
    expect((thread as unknown as Record<string, unknown>)['agentSessionId']).toBeUndefined()
    expect(selectActiveThreadAgentSessionId(state)).toBe('sess-legacy-codex')
  })

  it('批注会话同样按运行时分桶：换 Agent 后旧桶保留、新桶独立', async () => {
    const key = annotationFileKey('fp-switch', '/book.epub')
    useAnnotationAgentStore.getState().ensureFile(key)
    useAnnotationAgentStore.getState().bindSessionId('ann-codex-1', CODEX)
    expect(
      annotationOwnsSessionId(useAnnotationAgentStore.getState(), 'ann-codex-1'),
    ).toBe(true)

    // 换运行时后新建的批注会话记入新桶，旧桶不动
    useAcpUiStore.getState().setSelectedRuntimeId(ANTIGRAVITY)
    useAnnotationAgentStore.getState().bindSessionId('ann-antigravity-1', ANTIGRAVITY)
    const thread =
      useAnnotationAgentStore.getState().byFileKey[key]!.threads[0]!
    expect(thread.agentSessionIds?.[CODEX]).toBe('ann-codex-1')
    expect(thread.agentSessionIds?.[ANTIGRAVITY]).toBe('ann-antigravity-1')
  })

  it('批注旧版持久化自动迁移：单值 agentSessionId 归入 codex 桶', async () => {
    const key = annotationFileKey('fp-legacy', '/book.epub')
    localStorage.setItem(
      'inkdown-annotation-agent',
      JSON.stringify({
        state: {
          byFileKey: {
            [key]: {
              activeThreadId: 'ann-thread-legacy',
              threads: [
                {
                  id: 'ann-thread-legacy',
                  title: '批注助手',
                  createdAt: 1,
                  updatedAt: 2,
                  agentSessionId: 'ann-legacy-codex',
                  messages: [],
                },
              ],
            },
          },
        },
        version: 0,
      }),
    )
    await useAnnotationAgentStore.persist.rehydrate()
    const thread =
      useAnnotationAgentStore.getState().byFileKey[key]!.threads[0]!
    expect(thread.agentSessionIds?.[CODEX]).toBe('ann-legacy-codex')
    expect((thread as unknown as Record<string, unknown>)['agentSessionId']).toBeUndefined()
    expect(
      annotationOwnsSessionId(useAnnotationAgentStore.getState(), 'ann-legacy-codex'),
    ).toBe(true)
  })
})
