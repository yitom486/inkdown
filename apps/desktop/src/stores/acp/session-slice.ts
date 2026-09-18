import type { StateCreator } from 'zustand'
import { DEFAULT_ACP_RUNTIME_ID } from '@inkdown/contracts'
import type {
  AcpConfigOption,
  AcpConnectionStatus,
  AcpPromptCapabilities,
  AppErrorCode,
} from '@inkdown/contracts'
import {
  rememberPreferredConfig,
  type AcpPreferredConfigMap,
} from '@/lib/agent/acp-config-preferences'
import type { AcpUiStore } from './acp-types'
import { createEmptyThread, patchActiveThread } from './chat-helpers'

export interface SessionSlice {
  selectedRuntimeId: string
  status: AcpConnectionStatus
  sessionId: string | null
  statusError?: string
  statusErrorCode?: AppErrorCode
  configOptions: AcpConfigOption[]
  prompting: boolean
  promptCapabilities: AcpPromptCapabilities
  preferredConfigByRuntime: AcpPreferredConfigMap

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
}

export const createSessionSlice: StateCreator<
  AcpUiStore,
  [],
  [],
  SessionSlice
> = (set, get) => ({
  selectedRuntimeId: DEFAULT_ACP_RUNTIME_ID,
  status: 'disconnected',
  sessionId: null,
  statusError: undefined,
  configOptions: [],
  prompting: false,
  promptCapabilities: {},
  preferredConfigByRuntime: {},

  setSelectedRuntimeId: (id) =>
    set((s) => {
      if (s.selectedRuntimeId === id) return s

      // 寻找目标 Agent 下的已有线程列表
      const targetThreads = s.threads.filter(
        (t) => (t.runtimeId || DEFAULT_ACP_RUNTIME_ID) === id,
      )
      let threads = s.threads
      let activeThreadId = s.activeThreadId

      if (targetThreads.length > 0) {
        const sorted = [...targetThreads].sort((a, b) => b.updatedAt - a.updatedAt)
        activeThreadId = sorted[0]!.id
      } else {
        // 该 Agent 尚无历史线程，自动为其创建专属空白线程
        const fresh = createEmptyThread(undefined, id)
        threads = [fresh, ...threads]
        activeThreadId = fresh.id
      }

      return {
        selectedRuntimeId: id,
        threads,
        activeThreadId,
        prompting: false,
        pendingPermission: null,
        // 切换 Agent 后立即清空旧 Agent 遗留的模型选项与能力缓存
        configOptions: [],
        promptCapabilities: {},
      }
    }),

  setStatus: (status, errorMessage, errorCode) =>
    set({
      status,
      statusError: errorMessage,
      statusErrorCode: errorCode,
      ...(status === 'connected'
        ? { statusError: undefined, statusErrorCode: undefined }
        : {}),
      ...(status === 'disconnected' || status === 'error'
        ? {
            prompting: false,
            pendingPermission: null,
            promptCapabilities: {},
            configOptions: [],
          }
        : {}),
    }),

  setSession: (sessionId, configOptions) =>
    set((s) => ({
      sessionId,
      ...(configOptions ? { configOptions } : {}),
      // 仅在拿到有效 session 时写入 thread；断开时按运行时保留以便恢复
      ...(sessionId
        ? patchActiveThread(s, (t) => ({
            ...t,
            agentSessionIds: {
              ...(t.agentSessionIds ?? {}),
              [s.selectedRuntimeId]: sessionId,
            },
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
})
