import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { DEFAULT_ACP_RUNTIME_ID } from '@shared/constants/acp-agents'
import type { AppErrorCode } from '@shared/core/errors'
import type {
  AcpConfigOption,
  AcpConnectionStatus,
  AcpPromptCapabilities,
} from '@shared/types/acp'
import {
  type AcpChatMessage,
  type AcpChatRole,
  extractTextFromContent,
  flattenToolContent,
  isToolActiveStatus,
  parseToolDiffs,
  parseToolLocations,
} from '@/stores/acp-chat-types'
import type { AcpMessageAttachment } from '@/lib/agent/acp-composer'
import { parseAcpPlanEntries, summarizePlanProgress } from '@/lib/agent/acp-plan'
import { pruneIntermediateAgentReplies } from '@/lib/agent/acp-prune-agent-replies'
import {
  rememberPreferredConfig,
  type AcpPreferredConfigMap,
} from '@/lib/agent/acp-config-preferences'
import { pruneBlankThreads } from '@/lib/agent/acp-thread-prune'
import {
  toolCallIdFromPermission,
  type AcpPermissionOptionView,
} from '@/lib/agent/acp-permission'
import { enrichAcpToolMessage } from '@/lib/agent/enrich-tool-message'
import { acpDevLog } from '@/lib/agent/acp-dev-log'
import {
  promoteChapterMarkPlansToLastAgent,
  selectChapterMarkPlanOnMessages,
} from '@/lib/agent/promote-chapter-mark-plans'
import {
  promoteMarkProposalsToLastAgent,
  resolveMarkProposalOnMessages,
} from '@/lib/agent/promote-mark-proposals'
import {
  isProposeMarkToolTitle,
  parseMarkProposalsFromTool,
} from '@/lib/agent/parse-mark-proposal'
import type { MarkProposalStatus } from '@shared/types/mark-proposal'

export interface AcpPendingPermission {
  requestId: number
  sessionId?: string
  toolCallId?: string
  summary: string
  options: AcpPermissionOptionView[]
  toolCall?: Record<string, unknown>
}

export type { AcpChatMessage, AcpChatRole } from '@/stores/acp-chat-types'

const MAX_THREADS = 40
const MAX_MESSAGES_PER_THREAD = 300

export interface AcpChatThread {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  workspaceRoot?: string
  /** 关联的 ACP sessionId：断开后仍保留，供重连 resume/load */
  agentSessionId?: string | null
  messages: AcpChatMessage[]
}

interface AcpUiStore {
  panelOpen: boolean
  selectedRuntimeId: string
  status: AcpConnectionStatus
  sessionId: string | null
  statusError?: string
  statusErrorCode?: AppErrorCode
  configOptions: AcpConfigOption[]
  prompting: boolean
  /** 当前连接 Agent 的 prompt 能力（不持久化） */
  promptCapabilities: AcpPromptCapabilities
  threads: AcpChatThread[]
  activeThreadId: string
  historyOpen: boolean
  /**
   * 各运行时下用户选过的 Mode / Model 等（persist）。
   * 连接后写回 Agent，避免每次重开都回到默认。
   */
  preferredConfigByRuntime: AcpPreferredConfigMap
  /** 当前待用户审批的工具权限（不持久化） */
  pendingPermission: AcpPendingPermission | null
  /** MCP 快照先于对应 tool_call 到达时暂存；仅当前回合有效，不持久化。 */
  pendingMarkProposalSnapshotContents: string[]
  /** 递增以触发 AgentComposer 聚焦（不持久化） */
  composerFocusNonce: number
  /** 递增以在输入框追加「选区」短标记（不持久化） */
  composerInsertNonce: number
  setPanelOpen: (open: boolean) => void
  togglePanel: () => void
  /** 面板已打开时聚焦输入框；不会强行打开面板（阅读器划选等场景） */
  requestComposerFocus: () => void
  /** 打开 Agent 面板并聚焦输入框（选区「问 Agent」） */
  openPanelAndFocusComposer: () => void
  /** 打开面板、聚焦，并通知输入框插入选区短标记 */
  insertComposerSelectionMarker: () => void
  setHistoryOpen: (open: boolean) => void
  setSelectedRuntimeId: (id: string) => void
  setStatus: (status: AcpConnectionStatus, errorMessage?: string, errorCode?: AppErrorCode) => void
  setSession: (sessionId: string | null, configOptions?: AcpConfigOption[]) => void
  setConfigOptions: (options: AcpConfigOption[]) => void
  setPromptCapabilities: (caps: AcpPromptCapabilities) => void
  setPrompting: (prompting: boolean) => void
  rememberConfigPreference: (
    runtimeId: string,
    configId: string,
    value: string | boolean,
  ) => void
  setPendingPermission: (pending: AcpPendingPermission | null) => void
  /** 把 permission 请求里的 toolCall 写入时间线，保证审批卡能挂上工具气泡 */
  ingestPermissionRequest: (pending: AcpPendingPermission) => void
  clearPendingPermission: (requestId?: number) => void
  appendUserMessage: (text: string, attachments?: AcpMessageAttachment[]) => void
  appendSystemMessage: (text: string) => void
  beginAgentReply: () => void
  clearMessages: () => void
  applySessionUpdate: (update: Record<string, unknown>) => void
  finishStreaming: () => void
  /** MCP 结果不会回传到 ACP session/update 时，由快照响应直接补到对应工具消息。 */
  attachMarkProposalsFromSnapshot: (content: string) => void
  resolveMarkProposal: (proposalId: string, status: Exclude<MarkProposalStatus, 'pending'>) => void
  selectChapterMarkPlan: (entryId: string) => void
  createThread: (workspaceRoot?: string) => string
  switchThread: (threadId: string) => void
  deleteThread: (threadId: string) => void
  renameThread: (threadId: string, title: string) => void
}

function finalizeThreadMessages(messages: AcpChatMessage[]): AcpChatMessage[] {
  return promoteChapterMarkPlansToLastAgent(
    promoteMarkProposalsToLastAgent(
      messages.map((m) => (m.role === 'tool' ? enrichAcpToolMessage(m) : m)),
    ),
  )
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function createEmptyThread(workspaceRoot?: string): AcpChatThread {
  const now = Date.now()
  return {
    id: newId('thread'),
    title: '新对话',
    createdAt: now,
    updatedAt: now,
    workspaceRoot,
    agentSessionId: null,
    messages: [],
  }
}

function titleFromMessages(messages: AcpChatMessage[]): string {
  const user = messages.find(
    (m) => m.role === 'user' && (m.text.trim() || (m.attachments?.length ?? 0) > 0),
  )
  if (!user) return '新对话'
  const t = user.text.replace(/\s+/g, ' ').trim()
  if (t) return t.length > 36 ? `${t.slice(0, 36)}…` : t
  const first = user.attachments?.[0]?.name
  return first ? `附件 · ${first}` : '新对话'
}

function freezeMessages(messages: AcpChatMessage[]): AcpChatMessage[] {
  return messages.slice(-MAX_MESSAGES_PER_THREAD).map((m) => {
    const base = m.streaming ? { ...m, streaming: false } : m
    if (!base.attachments?.length) return base
    return {
      ...base,
      attachments: base.attachments.map((a) =>
        a.previewUrl?.startsWith('blob:')
          ? { ...a, previewUrl: undefined }
          : a,
      ),
    }
  })
}

function ensureThreadList(threads: AcpChatThread[], workspaceRoot?: string): {
  threads: AcpChatThread[]
  activeThreadId: string
} {
  if (threads.length === 0) {
    const fresh = createEmptyThread(workspaceRoot)
    return { threads: [fresh], activeThreadId: fresh.id }
  }
  return { threads, activeThreadId: threads[0]!.id }
}

function openPanelPreservingThread(
  state: Pick<AcpUiStore, 'threads' | 'activeThreadId'>,
  workspaceRoot?: string,
): Pick<AcpUiStore, 'threads' | 'activeThreadId' | 'historyOpen'> {
  // 打开面板：保留当前会话（有内容的继续聊）；仅在没有任何线程时补一条空草稿
  const pruned = pruneBlankThreads(state.threads, { keepId: state.activeThreadId })
  const next = ensureThreadList(pruned, workspaceRoot)
  const activeThreadId = next.threads.some((t) => t.id === state.activeThreadId)
    ? state.activeThreadId
    : next.activeThreadId
  return { threads: next.threads, activeThreadId, historyOpen: false }
}

function patchActiveThread(
  state: Pick<AcpUiStore, 'threads' | 'activeThreadId'>,
  patch: (thread: AcpChatThread) => AcpChatThread,
): { threads: AcpChatThread[] } {
  const threads = state.threads.map((t) =>
    t.id === state.activeThreadId ? patch(t) : t,
  )
  return { threads }
}



interface MarkProposalAttachResult {
  messages: AcpChatMessage[]
  attached: boolean
  toolCallId?: string
  proposalCount?: number
}

function attachMarkProposalsToCurrentTurn(
  messages: AcpChatMessage[],
  content: string,
): MarkProposalAttachResult {
  let turnStart = -1
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') {
      turnStart = i
      break
    }
  }

  let index = -1
  for (let i = messages.length - 1; i > turnStart; i -= 1) {
    const message = messages[i]
    if (
      message?.role === 'tool' &&
      !message.markProposal &&
      !message.markProposals?.length &&
      isProposeMarkToolTitle(message.toolTitle)
    ) {
      index = i
      break
    }
  }
  if (index < 0) return { messages, attached: false }

  const tool = messages[index]!
  const proposals = parseMarkProposalsFromTool(tool.toolTitle, content, tool.toolCallId)
  if (proposals.length === 0) return { messages, attached: false, toolCallId: tool.toolCallId }

  const next = [...messages]
  next[index] =
    proposals.length === 1
      ? {
          ...tool,
          toolContentText: content,
          text: content,
          markProposal: proposals[0],
          markProposalStatus: 'pending',
        }
      : {
          ...tool,
          toolContentText: content,
          text: content,
          markProposals: proposals.map((proposal) => ({
            proposal,
            status: 'pending' as const,
          })),
        }
  return {
    messages: next,
    attached: true,
    toolCallId: tool.toolCallId,
    proposalCount: proposals.length,
  }
}

function attachPendingMarkProposals(
  messages: AcpChatMessage[],
  contents: string[],
): { messages: AcpChatMessage[]; remaining: string[]; attachedCount: number } {
  let next = messages
  const remaining: string[] = []
  let attachedCount = 0
  for (const content of contents) {
    const attached = attachMarkProposalsToCurrentTurn(next, content)
    if (!attached.attached) {
      remaining.push(content)
      continue
    }
    next = attached.messages
    attachedCount += attached.proposalCount ?? 0
  }
  return { messages: next, remaining, attachedCount }
}

function applyToolCallUpdate(
  messages: AcpChatMessage[],
  update: Record<string, unknown>,
): AcpChatMessage[] {
  const toolCallId =
    typeof update.toolCallId === 'string'
      ? update.toolCallId
      : typeof update.tool_call_id === 'string'
        ? update.tool_call_id
        : ''
  if (!toolCallId) return messages

  const next = [...messages]
  const idx = next.findIndex((m) => m.role === 'tool' && m.toolCallId === toolCallId)
  const prev = idx >= 0 ? next[idx] : undefined

  const status =
    typeof update.status === 'string'
      ? update.status
      : (prev?.toolStatus ?? 'pending')
  const title =
    typeof update.title === 'string'
      ? update.title
      : (prev?.toolTitle ?? '工具调用')
  const kind =
    typeof update.kind === 'string' ? update.kind : (prev?.toolKind ?? 'other')

  let contentText = prev?.toolContentText ?? prev?.text ?? ''
  let toolDiffs = prev?.toolDiffs
  if ('content' in update) {
    contentText = flattenToolContent(update.content)
    toolDiffs = parseToolDiffs(update.content)
  }

  let locations = prev?.toolLocations
  if ('locations' in update) {
    locations = parseToolLocations(update.locations)
  }

  const active = isToolActiveStatus(status)
  const base: AcpChatMessage = {
    id: prev?.id ?? newId('tool'),
    role: 'tool',
    toolCallId,
    toolKind: kind,
    toolStatus: status,
    toolTitle: title,
    toolContentText: contentText,
    toolDiffs: toolDiffs && toolDiffs.length > 0 ? toolDiffs : undefined,
    toolLocations: locations,
    text: contentText || title,
    createdAt: prev?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    streaming: active,
    markProposal: prev?.markProposal,
    markProposalStatus: prev?.markProposalStatus,
    markProposals: prev?.markProposals,
    chapterMarkPlan: prev?.chapterMarkPlan,
  }
  const message = enrichAcpToolMessage(base)

  if (idx >= 0) next[idx] = message
  else {
    const emptyAgentIdx = next.findIndex(
      (m) => m.role === 'agent' && m.streaming && !m.text.trim(),
    )
    if (emptyAgentIdx >= 0) next.splice(emptyAgentIdx, 0, message)
    else next.push(message)
  }
  return next
}

const initialThread = createEmptyThread()

export const useAcpUiStore = create<AcpUiStore>()(
  persist(
    (set, get) => ({
      panelOpen: false,
      selectedRuntimeId: DEFAULT_ACP_RUNTIME_ID,
      status: 'disconnected',
      sessionId: null,
      statusError: undefined,
      configOptions: [],
      prompting: false,
      promptCapabilities: {},
      threads: [initialThread],
      activeThreadId: initialThread.id,
      historyOpen: false,
      preferredConfigByRuntime: {},
      pendingPermission: null,
      pendingMarkProposalSnapshotContents: [],
      composerFocusNonce: 0,
      composerInsertNonce: 0,

      setPanelOpen: (open) =>
        set((s) => {
          if (!open) {
            const workspaceRoot = s.threads.find(
              (t) => t.id === s.activeThreadId,
            )?.workspaceRoot
            const next = ensureThreadList(pruneBlankThreads(s.threads), workspaceRoot)
            const activeThreadId = next.threads.some((t) => t.id === s.activeThreadId)
              ? s.activeThreadId
              : next.activeThreadId
            return {
              panelOpen: false,
              historyOpen: false,
              threads: next.threads,
              activeThreadId,
            }
          }
          return {
            panelOpen: true,
            ...openPanelPreservingThread(s),
          }
        }),
      togglePanel: () => {
        const open = !get().panelOpen
        get().setPanelOpen(open)
      },
      requestComposerFocus: () => {
        const { panelOpen, composerFocusNonce } = get()
        if (!panelOpen) return
        set({ composerFocusNonce: composerFocusNonce + 1 })
      },
      openPanelAndFocusComposer: () =>
        set((s) => ({
          ...(s.panelOpen
            ? { panelOpen: true }
            : { panelOpen: true, ...openPanelPreservingThread(s) }),
          composerFocusNonce: s.composerFocusNonce + 1,
        })),
      insertComposerSelectionMarker: () =>
        set((s) => ({
          ...(s.panelOpen
            ? { panelOpen: true }
            : { panelOpen: true, ...openPanelPreservingThread(s) }),
          composerFocusNonce: s.composerFocusNonce + 1,
          composerInsertNonce: s.composerInsertNonce + 1,
        })),
      setHistoryOpen: (open) => set({ historyOpen: open }),
      setSelectedRuntimeId: (id) => set({ selectedRuntimeId: id }),

      setStatus: (status, errorMessage, errorCode) =>
        set({
          status,
          statusError: errorMessage,
          statusErrorCode: errorCode,
          ...(status === 'connected'
            ? { statusError: undefined, statusErrorCode: undefined }
            : {}),
          ...(status === 'disconnected' || status === 'error'
            ? { prompting: false, pendingPermission: null, promptCapabilities: {} }
            : {}),
        }),

      setSession: (sessionId, configOptions) =>
        set((s) => ({
          sessionId,
          ...(configOptions ? { configOptions } : {}),
          // 仅在拿到有效 session 时写入 thread；断开时保留 agentSessionId 以便恢复
          ...(sessionId
            ? patchActiveThread(s, (t) => ({
                ...t,
                agentSessionId: sessionId,
                updatedAt: Date.now(),
              }))
            : {}),
        })),

      setConfigOptions: (options) => set({ configOptions: options }),
      setPromptCapabilities: (caps) => set({ promptCapabilities: caps }),
      setPrompting: (prompting) => set({ prompting }),
      rememberConfigPreference: (runtimeId, configId, value) =>
        set((s) => ({
          preferredConfigByRuntime: rememberPreferredConfig(
            s.preferredConfigByRuntime,
            runtimeId,
            configId,
            value,
          ),
        })),
      setPendingPermission: (pending) => set({ pendingPermission: pending }),
      clearPendingPermission: (requestId) =>
        set((s) => {
          if (
            requestId != null &&
            s.pendingPermission &&
            s.pendingPermission.requestId !== requestId
          ) {
            return s
          }
          return { pendingPermission: null }
        }),
      ingestPermissionRequest: (pending) => {
        set({ pendingPermission: pending })
        const toolCall = pending.toolCall
        if (!toolCall) return
        const toolCallId = pending.toolCallId ?? toolCallIdFromPermission(toolCall)
        if (!toolCallId) return
        const update: Record<string, unknown> = {
          sessionUpdate: 'tool_call',
          toolCallId,
          title:
            typeof toolCall.title === 'string' ? toolCall.title : pending.summary,
          kind: typeof toolCall.kind === 'string' ? toolCall.kind : 'other',
          status:
            typeof toolCall.status === 'string' ? toolCall.status : 'pending',
        }
        if ('content' in toolCall) update.content = toolCall.content
        if ('locations' in toolCall) update.locations = toolCall.locations
        get().applySessionUpdate(update)
      },

      appendUserMessage: (text, attachments) =>
        set((s) => ({
          pendingMarkProposalSnapshotContents: [],
          ...patchActiveThread(s, (t) => {
            const messages = [
              ...t.messages,
              {
                id: newId('user'),
                role: 'user' as const,
                text,
                createdAt: Date.now(),
                ...(attachments && attachments.length > 0 ? { attachments } : {}),
              },
            ]
            return {
              ...t,
              messages,
              title: t.title === '新对话' ? titleFromMessages(messages) : t.title,
              updatedAt: Date.now(),
            }
          }),
        })),

      appendSystemMessage: (text) =>
        set((s) =>
          patchActiveThread(s, (t) => ({
            ...t,
            messages: [
              ...t.messages,
              { id: newId('sys'), role: 'system', text, createdAt: Date.now() },
            ],
            updatedAt: Date.now(),
          })),
        ),

      beginAgentReply: () =>
        set((s) =>
          patchActiveThread(s, (t) => {
            const last = t.messages[t.messages.length - 1]
            if (last?.role === 'agent' && last.streaming) return t
            return {
              ...t,
              messages: [
                ...t.messages,
                {
                  id: newId('agent'),
                  role: 'agent',
                  text: '',
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  streaming: true,
                },
              ],
              updatedAt: Date.now(),
            }
          }),
        ),

      clearMessages: () =>
        set((s) => ({
          pendingMarkProposalSnapshotContents: [],
          ...patchActiveThread(s, (t) => ({
            ...t,
            messages: [],
            title: '新对话',
            updatedAt: Date.now(),
          })),
        })),

      finishStreaming: () =>
        set((s) => ({
          prompting: false,
          ...patchActiveThread(s, (t) => {
            const now = Date.now()
            const frozen = t.messages.map((m) => {
              if (!m.streaming) return m
              if (m.role === 'tool' && isToolActiveStatus(m.toolStatus)) {
                return enrichAcpToolMessage({
                  ...m,
                  streaming: false,
                  updatedAt: now,
                  toolStatus: m.toolStatus === 'pending' ? 'cancelled' : 'completed',
                })
              }
              return { ...m, streaming: false, updatedAt: now }
            })
            return {
              ...t,
              updatedAt: now,
              messages: finalizeThreadMessages(pruneIntermediateAgentReplies(frozen)),
            }
          }),
        })),

      attachMarkProposalsFromSnapshot: (content) =>
        set((s) => {
          let remaining = [...s.pendingMarkProposalSnapshotContents, content]
          let attachedCount = 0
          const patched = patchActiveThread(s, (t) => {
            const attached = attachPendingMarkProposals(t.messages, remaining)
            remaining = attached.remaining.slice(-3)
            attachedCount = attached.attachedCount
            const hasStreamingAgent = attached.messages.some(
              (message) => message.role === 'agent' && message.streaming,
            )
            return {
              ...t,
              messages: hasStreamingAgent
                ? attached.messages
                : finalizeThreadMessages(attached.messages),
              updatedAt: Date.now(),
            }
          })
          acpDevLog('mark-proposal snapshot result', {
            chars: content.length,
            attachedCount,
            queuedCount: remaining.length,
          })
          return { ...patched, pendingMarkProposalSnapshotContents: remaining }
        }),

      resolveMarkProposal: (proposalId, status) =>
        set((s) =>
          patchActiveThread(s, (t) => ({
            ...t,
            messages: resolveMarkProposalOnMessages(t.messages, proposalId, status),
            updatedAt: Date.now(),
          })),
        ),

      selectChapterMarkPlan: (entryId) =>
        set((s) =>
          patchActiveThread(s, (t) => ({
            ...t,
            messages: selectChapterMarkPlanOnMessages(t.messages, entryId),
            updatedAt: Date.now(),
          })),
        ),

      createThread: (workspaceRoot) => {
        const thread = createEmptyThread(workspaceRoot)
        set((s) => {
          const frozen = s.threads.map((t) =>
            t.id === s.activeThreadId
              ? { ...t, messages: freezeMessages(t.messages), updatedAt: Date.now() }
              : t,
          )
          // 新建时丢掉其它空白草稿（含刚离开的空会话）
          const kept = pruneBlankThreads(frozen)
          const threads = [thread, ...kept].slice(0, MAX_THREADS)
          return {
            threads,
            activeThreadId: thread.id,
            prompting: false,
            historyOpen: false,
            pendingMarkProposalSnapshotContents: [],
          }
        })
        return thread.id
      },

      switchThread: (threadId) => {
        const s = get()
        if (threadId === s.activeThreadId) return
        if (s.prompting) return
        if (!s.threads.some((t) => t.id === threadId)) return
        const frozen = s.threads.map((t) =>
          t.id === s.activeThreadId
            ? { ...t, messages: freezeMessages(t.messages), updatedAt: Date.now() }
            : t,
        )
        // 切走时若原会话空白则删除；目标会话即使空白也保留
        const threads = pruneBlankThreads(frozen, { keepId: threadId })
        set({
          activeThreadId: threadId,
          prompting: false,
          historyOpen: false,
          threads,
          pendingMarkProposalSnapshotContents: [],
        })
      },

      deleteThread: (threadId) =>
        set((s) => {
          let threads = s.threads.filter((t) => t.id !== threadId)
          if (threads.length === 0) {
            const fresh = createEmptyThread()
            return {
              threads: [fresh],
              activeThreadId: fresh.id,
              prompting: false,
            }
          }
          const activeThreadId =
            s.activeThreadId === threadId ? threads[0]!.id : s.activeThreadId
          return { threads, activeThreadId, prompting: false }
        }),

      renameThread: (threadId, title) =>
        set((s) => ({
          threads: s.threads.map((t) =>
            t.id === threadId
              ? { ...t, title: title.trim() || '新对话', updatedAt: Date.now() }
              : t,
          ),
        })),

      applySessionUpdate: (update) => {
        const kind =
          typeof update.sessionUpdate === 'string' ? update.sessionUpdate : ''

        if (kind === 'config_option_update' || kind === 'config_options_update') {
          return
        }

        if (kind === 'plan' || kind === 'plan_update') {
          const entries = parseAcpPlanEntries(update)
          if (entries.length === 0 && kind === 'plan_update') {
            // 空 entries 视为清空该计划卡片
          }
          const summary = summarizePlanProgress(entries)
          set((s) =>
            patchActiveThread(s, (t) => {
              const messages = [...t.messages]
              const idx = messages.findIndex((m) => m.role === 'plan')
              const prev = idx >= 0 ? messages[idx] : undefined
              const next: AcpChatMessage = {
                id: prev?.id ?? newId('plan'),
                role: 'plan',
                text: entries.map((e) => e.content).join('\n'),
                planEntries: entries,
                createdAt: prev?.createdAt ?? Date.now(),
                updatedAt: Date.now(),
                streaming: summary.active,
              }
              if (idx >= 0) messages[idx] = next
              else {
                const emptyAgentIdx = messages.findIndex(
                  (m) => m.role === 'agent' && m.streaming && !m.text.trim(),
                )
                if (emptyAgentIdx >= 0) messages.splice(emptyAgentIdx, 0, next)
                else messages.push(next)
              }
              return { ...t, messages, updatedAt: Date.now() }
            }),
          )
          return
        }

        if (kind === 'tool_call' || kind === 'tool_call_update') {
          set((s) => {
            let remaining = s.pendingMarkProposalSnapshotContents
            let attachedCount = 0
            let proposalToolTitle: string | undefined
            const toolCallId =
              typeof update.toolCallId === 'string'
                ? update.toolCallId
                : typeof update.tool_call_id === 'string'
                  ? update.tool_call_id
                  : undefined
            const patched = patchActiveThread(s, (t) => {
              const updated = applyToolCallUpdate(t.messages, update)
              const currentTool = [...updated]
                .reverse()
                .find(
                  (message) =>
                    message.role === 'tool' &&
                    message.toolCallId === toolCallId,
                )
              proposalToolTitle = currentTool?.toolTitle
              const attached = attachPendingMarkProposals(updated, remaining)
              remaining = attached.remaining
              attachedCount = attached.attachedCount
              const hasStreamingAgent = attached.messages.some(
                (message) => message.role === 'agent' && message.streaming,
              )
              return {
                ...t,
                messages: hasStreamingAgent
                  ? attached.messages
                  : finalizeThreadMessages(attached.messages),
                updatedAt: Date.now(),
              }
            })
            if (isProposeMarkToolTitle(proposalToolTitle)) {
              acpDevLog('mark-proposal tool update', {
                toolCallId,
                title: proposalToolTitle,
                status: update.status,
                queuedBefore: s.pendingMarkProposalSnapshotContents.length,
                attachedCount,
                queuedAfter: remaining.length,
              })
            }
            return { ...patched, pendingMarkProposalSnapshotContents: remaining }
          })
          return
        }

        if (kind === 'tool_call_content_chunk') {
          const toolCallId =
            typeof update.toolCallId === 'string' ? update.toolCallId : ''
          if (!toolCallId) return
          const chunkText = flattenToolContent(
            update.content !== undefined ? [update.content] : update.content,
          )
          if (!chunkText) return
          set((s) =>
            patchActiveThread(s, (t) => {
              const messages = [...t.messages]
              const idx = messages.findIndex(
                (m) => m.role === 'tool' && m.toolCallId === toolCallId,
              )
              if (idx < 0) {
                messages.push({
                  id: newId('tool'),
                  role: 'tool',
                  toolCallId,
                  toolTitle: '工具调用',
                  toolKind: 'other',
                  toolStatus: 'in_progress',
                  toolContentText: chunkText,
                  text: chunkText,
                  createdAt: Date.now(),
                  streaming: true,
                })
              } else {
                const prev = messages[idx]!
                const merged = `${prev.toolContentText ?? prev.text ?? ''}${chunkText}`
                messages[idx] = {
                  ...prev,
                  toolContentText: merged,
                  text: merged,
                  // prompt 已结束时，结果分块仍可能晚到；不可把已完成工具重新标为流式，
                  // 否则不会重新解析为提议卡。
                  streaming: isToolActiveStatus(prev.toolStatus),
                  updatedAt: Date.now(),
                  toolStatus: prev.toolStatus ?? 'in_progress',
                }
              }
              const hasStreamingAgent = messages.some(
                (message) => message.role === 'agent' && message.streaming,
              )
              return {
                ...t,
                messages: hasStreamingAgent ? messages : finalizeThreadMessages(messages),
                updatedAt: Date.now(),
              }
            }),
          )
          return
        }

        const text = extractTextFromContent(update.content)
        if (
          !text &&
          kind !== 'agent_message_chunk' &&
          kind !== 'agent_thought_chunk' &&
          kind !== 'user_message_chunk'
        ) {
          return
        }

        const role: AcpChatRole =
          kind === 'agent_thought_chunk'
            ? 'thought'
            : kind === 'user_message_chunk'
              ? 'user'
              : 'agent'

        if (!text) return

        set((s) =>
          patchActiveThread(s, (t) => {
            const messages = [...t.messages]
            const last = messages[messages.length - 1]
            if (last && last.role === role && last.streaming) {
              messages[messages.length - 1] = {
                ...last,
                text: last.text + text,
                updatedAt: Date.now(),
              }
              return { ...t, messages, updatedAt: Date.now() }
            }

            const emptyAgentIdx = messages.findIndex(
              (m) => m.role === 'agent' && m.streaming && !m.text.trim(),
            )

            if (role === 'agent' && emptyAgentIdx >= 0) {
              messages[emptyAgentIdx] = {
                ...messages[emptyAgentIdx]!,
                text,
                updatedAt: Date.now(),
                streaming: true,
              }
              return { ...t, messages, updatedAt: Date.now() }
            }

            const nextMsg: AcpChatMessage = {
              id: newId(role),
              role,
              text,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              streaming: true,
            }

            if (role === 'thought' && emptyAgentIdx >= 0) {
              messages.splice(emptyAgentIdx, 0, nextMsg)
            } else {
              messages.push(nextMsg)
            }
            return { ...t, messages, updatedAt: Date.now() }
          }),
        )
      },
    }),
    {
      name: 'inkdown-acp-ui',
      partialize: (state) => ({
        // 重启 / 更新后恢复 Agent 面板展开状态（聊天记录本身另存）
        panelOpen: state.panelOpen,
        selectedRuntimeId: state.selectedRuntimeId,
        preferredConfigByRuntime: state.preferredConfigByRuntime,
        activeThreadId: state.activeThreadId,
        threads: pruneBlankThreads(state.threads)
          .map((t) => ({
            ...t,
            messages: freezeMessages(t.messages),
          }))
          .slice(0, MAX_THREADS),
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AcpUiStore>
        const rawThreads =
          Array.isArray(p.threads) && p.threads.length > 0
            ? p.threads
            : current.threads
        const pruned = pruneBlankThreads(rawThreads)
        const ensured = pruned.length > 0 ? pruned : current.threads
        const activeThreadId =
          typeof p.activeThreadId === 'string' &&
          ensured.some((t) => t.id === p.activeThreadId)
            ? p.activeThreadId
            : ensured[0]!.id
        const preferredConfigByRuntime =
          p.preferredConfigByRuntime && typeof p.preferredConfigByRuntime === 'object'
            ? p.preferredConfigByRuntime
            : current.preferredConfigByRuntime
        return {
          ...current,
          ...p,
          panelOpen: Boolean(p.panelOpen),
          threads: ensured,
          activeThreadId,
          preferredConfigByRuntime,
          prompting: false,
          composerFocusNonce: 0,
          composerInsertNonce: 0,
          status: 'disconnected',
          sessionId: null,
          configOptions: [],
          promptCapabilities: {},
          pendingPermission: null,
        }
      },
    },
  ),
)

export function useAcpPanelOpen() {
  return useAcpUiStore((s) => s.panelOpen)
}

export function useAcpActiveMessages(): AcpChatMessage[] {
  return useAcpUiStore(
    useShallow((s) => {
      const thread = s.threads.find((t) => t.id === s.activeThreadId)
      return thread?.messages ?? []
    }),
  )
}

export function useAcpPendingPermission() {
  return useAcpUiStore((s) => s.pendingPermission)
}

/**
 * Agent 面板外壳所需的状态。
 *
 * 不返回当前线程的 messages/threads 数组，避免流式消息更新时让标题栏、
 * 配置栏和输入栏一起重渲染。消息列表通过 useAcpActiveMessages 单独订阅。
 */
export function useAcpChatShell() {
  return useAcpUiStore(
    useShallow((s) => {
      const thread = s.threads.find((t) => t.id === s.activeThreadId)
      return {
        status: s.status,
        statusError: s.statusError,
        statusErrorCode: s.statusErrorCode,
        configOptions: s.configOptions,
        promptCapabilities: s.promptCapabilities,
        prompting: s.prompting,
        selectedRuntimeId: s.selectedRuntimeId,
        activeTitle: thread && thread.title !== '新对话' ? thread.title : null,
      }
    }),
  )
}

export function useAcpChatView() {
  return useAcpUiStore(
    useShallow((s) => {
      const thread = s.threads.find((t) => t.id === s.activeThreadId)
      return {
        status: s.status,
        sessionId: s.sessionId,
        statusError: s.statusError,
        configOptions: s.configOptions,
        promptCapabilities: s.promptCapabilities,
        messages: thread?.messages ?? [],
        prompting: s.prompting,
        selectedRuntimeId: s.selectedRuntimeId,
        activeThreadId: s.activeThreadId,
        threads: s.threads,
        historyOpen: s.historyOpen,
        pendingPermission: s.pendingPermission,
      }
    }),
  )
}
