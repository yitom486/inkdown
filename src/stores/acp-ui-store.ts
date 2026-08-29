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
  parseToolLocations,
} from '@/stores/acp-chat-types'

export type { AcpChatMessage, AcpChatRole } from '@/stores/acp-chat-types'

interface AcpUiStore {
  panelOpen: boolean
  selectedRuntimeId: string
  status: AcpConnectionStatus
  sessionId: string | null
  statusError?: string
  configOptions: AcpConfigOption[]
  messages: AcpChatMessage[]
  prompting: boolean
  setPanelOpen: (open: boolean) => void
  togglePanel: () => void
  setSelectedRuntimeId: (id: string) => void
  setStatus: (status: AcpConnectionStatus, errorMessage?: string) => void
  setSession: (sessionId: string | null, configOptions?: AcpConfigOption[]) => void
  setConfigOptions: (options: AcpConfigOption[]) => void
  setPrompting: (prompting: boolean) => void
  appendUserMessage: (text: string) => void
  appendSystemMessage: (text: string) => void
  clearMessages: () => void
  applySessionUpdate: (update: Record<string, unknown>) => void
  finishStreaming: () => void
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
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
  if ('content' in update) {
    contentText = flattenToolContent(update.content)
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
    toolLocations: locations,
    text: contentText || title,
    streaming: active,
  }

  if (idx >= 0) next[idx] = message
  else next.push(message)
  return next
}

export const useAcpUiStore = create<AcpUiStore>()(
  persist(
    (set) => ({
      panelOpen: false,
      selectedRuntimeId: DEFAULT_ACP_RUNTIME_ID,
      status: 'disconnected',
      sessionId: null,
      statusError: undefined,
      configOptions: [],
      messages: [],
      prompting: false,

      setPanelOpen: (open) => set({ panelOpen: open }),
      togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
      setSelectedRuntimeId: (id) => set({ selectedRuntimeId: id }),

      setStatus: (status, errorMessage) =>
        set({
          status,
          statusError: errorMessage,
          ...(status === 'disconnected' || status === 'error'
            ? { prompting: false }
            : {}),
        }),

      setSession: (sessionId, configOptions) =>
        set({
          sessionId,
          ...(configOptions ? { configOptions } : {}),
        }),

      setConfigOptions: (options) => set({ configOptions: options }),
      setPrompting: (prompting) => set({ prompting }),

      appendUserMessage: (text) =>
        set((s) => ({
          messages: [...s.messages, { id: newId('user'), role: 'user', text }],
        })),

      appendSystemMessage: (text) =>
        set((s) => ({
          messages: [...s.messages, { id: newId('sys'), role: 'system', text }],
        })),

      clearMessages: () => set({ messages: [] }),

      finishStreaming: () =>
        set((s) => ({
          prompting: false,
          messages: s.messages.map((m) => {
            if (!m.streaming) return m
            if (m.role === 'tool' && isToolActiveStatus(m.toolStatus)) {
              return {
                ...m,
                streaming: false,
                toolStatus: m.toolStatus === 'pending' ? 'cancelled' : 'completed',
              }
            }
            return { ...m, streaming: false }
          }),
        })),

      applySessionUpdate: (update) => {
        const kind =
          typeof update.sessionUpdate === 'string' ? update.sessionUpdate : ''

        if (kind === 'config_option_update' || kind === 'config_options_update') {
          return
        }

        if (kind === 'tool_call' || kind === 'tool_call_update') {
          set((s) => ({ messages: applyToolCallUpdate(s.messages, update) }))
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
          set((s) => {
            const messages = [...s.messages]
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
                streaming: true,
              })
              return { messages }
            }
            const prev = messages[idx]
            const merged = `${prev.toolContentText ?? prev.text ?? ''}${chunkText}`
            messages[idx] = {
              ...prev,
              toolContentText: merged,
              text: merged,
              streaming: true,
              toolStatus: prev.toolStatus ?? 'in_progress',
            }
            return { messages }
          })
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

        set((s) => {
          const messages = [...s.messages]
          const last = messages[messages.length - 1]
          if (last && last.role === role && last.streaming) {
            messages[messages.length - 1] = {
              ...last,
              text: last.text + text,
            }
            return { messages }
          }
          messages.push({
            id: newId(role),
            role,
            text,
            streaming: true,
          })
          return { messages }
        })
      },
    }),
    {
      name: 'inkdown-acp-ui',
      partialize: (state) => ({
        panelOpen: state.panelOpen,
        selectedRuntimeId: state.selectedRuntimeId,
      }),
    },
  ),
)

export function useAcpPanelOpen() {
  return useAcpUiStore((s) => s.panelOpen)
}

export function useAcpChatView() {
  return useAcpUiStore(
    useShallow((s) => ({
      status: s.status,
      sessionId: s.sessionId,
      statusError: s.statusError,
      configOptions: s.configOptions,
      messages: s.messages,
      prompting: s.prompting,
      selectedRuntimeId: s.selectedRuntimeId,
    })),
  )
}
