import type { StateCreator } from 'zustand'
import { DEFAULT_ACP_RUNTIME_ID } from '@inkdown/contracts'
import {
  type AcpChatMessage,
  type AcpChatRole,
  extractTextFromContent,
  flattenToolContent,
  isToolActiveStatus,
} from '@/stores/acp-chat-types'
import type { AcpMessageAttachment } from '@/lib/agent/acp-composer'
import { parseAcpPlanEntries, summarizePlanProgress } from '@/lib/agent/acp-plan'
import { pruneIntermediateAgentReplies } from '@/lib/agent/acp-prune-agent-replies'
import { pruneBlankThreads } from '@/lib/agent/acp-thread-prune'
import { acpDevLog } from '@/lib/agent/acp-dev-log'
import {
  resolveMarkProposalOnMessages,
} from '@/lib/agent/promote-mark-proposals'
import {
  selectChapterMarkPlanOnMessages,
} from '@/lib/agent/promote-chapter-mark-plans'
import { isProposeMarkToolTitle } from '@/lib/agent/parse-mark-proposal'
import type { MarkProposalStatus } from '@inkdown/annotations'
import {
  MAX_THREADS,
  type AcpChatThread,
  type AcpUiStore,
} from './acp-types'
import {
  applyToolCallUpdate,
  attachPendingMarkProposals,
  createEmptyThread,
  finalizeThreadMessages,
  freezeMessages,
  newId,
  patchActiveThread,
  titleFromMessages,
} from './chat-helpers'

export interface ChatSlice {
  threads: AcpChatThread[]
  activeThreadId: string
  historyOpen: boolean
  pendingMarkProposalSnapshotContents: string[]

  setHistoryOpen: (open: boolean) => void
  appendUserMessage: (text: string, attachments?: AcpMessageAttachment[]) => void
  appendSystemMessage: (text: string) => void
  beginAgentReply: () => void
  clearMessages: () => void
  finishStreaming: () => void
  attachMarkProposalsFromSnapshot: (content: string) => void
  resolveMarkProposal: (proposalId: string, status: Exclude<MarkProposalStatus, 'pending'>) => void
  selectChapterMarkPlan: (entryId: string) => void
  createThread: (workspaceRoot?: string, runtimeId?: string) => string
  switchThread: (threadId: string) => void
  deleteThread: (threadId: string) => void
  renameThread: (threadId: string, title: string) => void
  applySessionUpdate: (update: Record<string, unknown>) => void
}

export const initialThread = createEmptyThread()

export const createChatSlice: StateCreator<
  AcpUiStore,
  [],
  [],
  ChatSlice
> = (set, get) => ({
  threads: [initialThread],
  activeThreadId: initialThread.id,
  historyOpen: false,
  pendingMarkProposalSnapshotContents: [],

  setHistoryOpen: (open) => set({ historyOpen: open }),

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

  createThread: (workspaceRoot, runtimeId) => {
    const rId = runtimeId ?? get().selectedRuntimeId
    const thread = createEmptyThread(workspaceRoot, rId)
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
      const currentRuntimeId = s.selectedRuntimeId
      const runtimeThreads = threads.filter(
        (t) => (t.runtimeId || DEFAULT_ACP_RUNTIME_ID) === currentRuntimeId,
      )
      if (runtimeThreads.length === 0) {
        const fresh = createEmptyThread(undefined, currentRuntimeId)
        threads = [fresh, ...threads]
        return {
          threads,
          activeThreadId: fresh.id,
          prompting: false,
        }
      }
      const activeThreadId =
        s.activeThreadId === threadId ? runtimeThreads[0]!.id : s.activeThreadId
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
})
