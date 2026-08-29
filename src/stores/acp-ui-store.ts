import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { DEFAULT_ACP_RUNTIME_ID } from '@shared/constants/acp-agents'
import type { AcpConfigOption, AcpConnectionStatus } from '@shared/types/acp'

export type AcpChatRole = 'user' | 'agent' | 'thought' | 'system'

export interface AcpChatMessage {
  id: string
  role: AcpChatRole
  text: string
  streaming?: boolean
}

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

function extractTextFromContent(content: unknown): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (typeof content === 'object' && content !== null) {
    const row = content as Record<string, unknown>
    if (typeof row.text === 'string') return row.text
    if (row.content) return extractTextFromContent(row.content)
  }
  return ''
}

export const useAcpUiStore = create<AcpUiStore>()(
  persist(
    (set, get) => ({
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
          messages: s.messages.map((m) =>
            m.streaming ? { ...m, streaming: false } : m,
          ),
        })),

      applySessionUpdate: (update) => {
        const kind = typeof update.sessionUpdate === 'string' ? update.sessionUpdate : ''

        if (kind === 'config_option_update' || kind === 'config_options_update') {
          const options = update.configOptions
          if (Array.isArray(options)) {
            // 渲染端再 parse 一次太重；这里假定主进程已规范化时可直接用
            // 实际由 hook 在 connect 时设置；此处忽略非标准形状
          }
          return
        }

        const text = extractTextFromContent(update.content)
        if (!text && kind !== 'agent_message_chunk' && kind !== 'agent_thought_chunk' && kind !== 'user_message_chunk') {
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
