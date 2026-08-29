import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { DEFAULT_ACP_RUNTIME_ID } from '@shared/constants/acp-agents'
import type { AcpConfigOption, AcpConnectionStatus } from '@shared/types/acp'
import {
  type AcpChatMessage,
  type AcpChatRole,
  extractTextFromContent,
  flattenToolContent,
  isToolActiveStatus,
  parseToolDiffs,
  parseToolLocations,
} from '@/stores/acp-chat-types'
import { parseAcpPlanEntries, summarizePlanProgress } from '@/lib/acp-plan'
import { pruneIntermediateAgentReplies } from '@/lib/acp-prune-agent-replies'
import {
  toolCallIdFromPermission,
  type AcpPermissionOptionView,
} from '@/lib/acp-permission'

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
  configOptions: AcpConfigOption[]
  prompting: boolean
  threads: AcpChatThread[]
  activeThreadId: string
  historyOpen: boolean
  /** 当前待用户审批的工具权限（不持久化） */
  pendingPermission: AcpPendingPermission | null
  setPanelOpen: (open: boolean) => void
  togglePanel: () => void
  setHistoryOpen: (open: boolean) => void
  setSelectedRuntimeId: (id: string) => void
  setStatus: (status: AcpConnectionStatus, errorMessage?: string) => void
  setSession: (sessionId: string | null, configOptions?: AcpConfigOption[]) => void
  setConfigOptions: (options: AcpConfigOption[]) => void
  setPrompting: (prompting: boolean) => void
  setPendingPermission: (pending: AcpPendingPermission | null) => void
  /** 把 permission 请求里的 toolCall 写入时间线，保证审批卡能挂上工具气泡 */
  ingestPermissionRequest: (pending: AcpPendingPermission) => void
  clearPendingPermission: (requestId?: number) => void
  appendUserMessage: (text: string) => void
  appendSystemMessage: (text: string) => void
  beginAgentReply: () => void
  clearMessages: () => void
  applySessionUpdate: (update: Record<string, unknown>) => void
  finishStreaming: () => void
  createThread: (workspaceRoot?: string) => string
  switchThread: (threadId: string) => void
  deleteThread: (threadId: string) => void
  renameThread: (threadId: string, title: string) => void
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
  const user = messages.find((m) => m.role === 'user' && m.text.trim())
  if (!user) return '新对话'
  const t = user.text.replace(/\s+/g, ' ').trim()
  return t.length > 36 ? `${t.slice(0, 36)}…` : t
}

function freezeMessages(messages: AcpChatMessage[]): AcpChatMessage[] {
  return messages.slice(-MAX_MESSAGES_PER_THREAD).map((m) =>
    m.streaming ? { ...m, streaming: false } : m,
  )
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
  const message: AcpChatMessage = {
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
  }

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
      threads: [initialThread],
      activeThreadId: initialThread.id,
      historyOpen: false,

      setPanelOpen: (open) => set({ panelOpen: open }),
      togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
      setHistoryOpen: (open) => set({ historyOpen: open }),
      setSelectedRuntimeId: (id) => set({ selectedRuntimeId: id }),

      setStatus: (status, errorMessage) =>
        set({
          status,
          statusError: errorMessage,
          ...(status === 'disconnected' || status === 'error'
            ? { prompting: false, pendingPermission: null }
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
      setPrompting: (prompting) => set({ prompting }),
      pendingPermission: null,
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

      appendUserMessage: (text) =>
        set((s) =>
          patchActiveThread(s, (t) => {
            const messages = [
              ...t.messages,
              { id: newId('user'), role: 'user' as const, text, createdAt: Date.now() },
            ]
            return {
              ...t,
              messages,
              title: t.title === '新对话' ? titleFromMessages(messages) : t.title,
              updatedAt: Date.now(),
            }
          }),
        ),

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
        set((s) =>
          patchActiveThread(s, (t) => ({
            ...t,
            messages: [],
            title: '新对话',
            updatedAt: Date.now(),
          })),
        ),

      finishStreaming: () =>
        set((s) => ({
          prompting: false,
          ...patchActiveThread(s, (t) => {
            const now = Date.now()
            const frozen = t.messages.map((m) => {
              if (!m.streaming) return m
              if (m.role === 'tool' && isToolActiveStatus(m.toolStatus)) {
                return {
                  ...m,
                  streaming: false,
                  updatedAt: now,
                  toolStatus: m.toolStatus === 'pending' ? 'cancelled' : 'completed',
                }
              }
              return { ...m, streaming: false, updatedAt: now }
            })
            return {
              ...t,
              updatedAt: now,
              // 回合结束：中间 Agent 进度气泡去掉，只留最后一条答复（工具/思考进折叠组）
              messages: pruneIntermediateAgentReplies(frozen),
            }
          }),
        })),

      createThread: (workspaceRoot) => {
        const thread = createEmptyThread(workspaceRoot)
        set((s) => {
          const frozen = s.threads.map((t) =>
            t.id === s.activeThreadId
              ? { ...t, messages: freezeMessages(t.messages), updatedAt: Date.now() }
              : t,
          )
          const threads = [thread, ...frozen].slice(0, MAX_THREADS)
          return {
            threads,
            activeThreadId: thread.id,
            prompting: false,
            historyOpen: false,
          }
        })
        return thread.id
      },

      switchThread: (threadId) => {
        const s = get()
        if (threadId === s.activeThreadId) return
        if (s.prompting) return
        if (!s.threads.some((t) => t.id === threadId)) return
        set({
          activeThreadId: threadId,
          prompting: false,
          historyOpen: false,
          threads: s.threads.map((t) =>
            t.id === s.activeThreadId
              ? { ...t, messages: freezeMessages(t.messages), updatedAt: Date.now() }
              : t,
          ),
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
          set((s) =>
            patchActiveThread(s, (t) => ({
              ...t,
              messages: applyToolCallUpdate(t.messages, update),
              updatedAt: Date.now(),
            })),
          )
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
                  streaming: true,
                  updatedAt: Date.now(),
                  toolStatus: prev.toolStatus ?? 'in_progress',
                }
              }
              return { ...t, messages, updatedAt: Date.now() }
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
        panelOpen: state.panelOpen,
        selectedRuntimeId: state.selectedRuntimeId,
        activeThreadId: state.activeThreadId,
        threads: state.threads.map((t) => ({
          ...t,
          messages: freezeMessages(t.messages),
        })),
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AcpUiStore>
        const threads =
          Array.isArray(p.threads) && p.threads.length > 0
            ? p.threads
            : current.threads
        const activeThreadId =
          typeof p.activeThreadId === 'string' &&
          threads.some((t) => t.id === p.activeThreadId)
            ? p.activeThreadId
            : threads[0]!.id
        return {
          ...current,
          ...p,
          threads,
          activeThreadId,
          prompting: false,
          status: 'disconnected',
          sessionId: null,
          configOptions: [],
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

export function useAcpChatView() {
  return useAcpUiStore(
    useShallow((s) => {
      const thread = s.threads.find((t) => t.id === s.activeThreadId)
      return {
        status: s.status,
        sessionId: s.sessionId,
        statusError: s.statusError,
        configOptions: s.configOptions,
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
