import { useCallback, useEffect, useState } from 'react'
import { isOk } from '@shared/core/result'
import type {
  AcpAuthMethod,
  AcpConfigOption,
  AcpConnectReadyResult,
  AcpContentBlock,
} from '@shared/types/acp'
import type { AcpMessageAttachment } from '@/lib/agent/acp-composer'
import { acpApi } from '@/api/acp-api'
import { buildInkdownPromptPrefix } from '@/lib/agent/context/build-prompt-prefix'
import { resetTurnContextTracker } from '@/lib/agent/context/should-attach-turn-context'
import { listPreferredConfigPatches } from '@/lib/agent/acp-config-preferences'
import { acpDevLog, acpDevWarn } from '@/lib/agent/acp-dev-log'
import { formatAcpConnectedMessage } from '@/lib/agent/acp-session-restore'
import { reportAppError } from '@/lib/workspace/report-error'
import { useAcpUiStore } from '@/stores/acp-ui-store'
import { useAnnotationAgentStore } from '@/stores/annotation-agent-store'

function activeThreadAgentSessionId(): string | undefined {
  const s = useAcpUiStore.getState()
  const thread = s.threads.find((t) => t.id === s.activeThreadId)
  return thread?.agentSessionId?.trim() || undefined
}

/** 连接就绪后：把 Zustand 里记住的 Mode/Model 等写回当前 ACP session */
async function applyStoredConfigPreferences(
  sessionId: string,
  runtimeId: string,
  initialOptions: AcpConfigOption[],
): Promise<AcpConfigOption[]> {
  const preferred =
    useAcpUiStore.getState().preferredConfigByRuntime[runtimeId] ?? undefined
  const patches = listPreferredConfigPatches(initialOptions, preferred)
  if (patches.length === 0) return initialOptions

  let latest = initialOptions
  for (const patch of patches) {
    const result = await acpApi.setConfigOption({
      sessionId,
      configId: patch.configId,
      value: patch.value,
    })
    if (!isOk(result)) {
      console.warn('[acp-ui] 套用配置偏好失败', patch, result.error)
      continue
    }
    if (result.value.configOptions.length > 0) {
      latest = result.value.configOptions
    }
  }
  return latest
}

export function useAcpSession(workspaceRoot?: string) {
  const setStatus = useAcpUiStore((s) => s.setStatus)
  const setSession = useAcpUiStore((s) => s.setSession)
  const setConfigOptions = useAcpUiStore((s) => s.setConfigOptions)
  const rememberConfigPreference = useAcpUiStore((s) => s.rememberConfigPreference)
  const applySessionUpdate = useAcpUiStore((s) => s.applySessionUpdate)
  const finishStreaming = useAcpUiStore((s) => s.finishStreaming)
  const appendUserMessage = useAcpUiStore((s) => s.appendUserMessage)
  const appendSystemMessage = useAcpUiStore((s) => s.appendSystemMessage)
  const beginAgentReply = useAcpUiStore((s) => s.beginAgentReply)
  const setPrompting = useAcpUiStore((s) => s.setPrompting)
  const setPromptCapabilities = useAcpUiStore((s) => s.setPromptCapabilities)
  const clearMessagesInStore = useAcpUiStore((s) => s.clearMessages)
  const selectedRuntimeId = useAcpUiStore((s) => s.selectedRuntimeId)
  const sessionId = useAcpUiStore((s) => s.sessionId)
  const prompting = useAcpUiStore((s) => s.prompting)

  const [authOpen, setAuthOpen] = useState(false)
  const [authMethods, setAuthMethods] = useState<AcpAuthMethod[]>([])
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    const offStatus = acpApi.onStatusChanged((event) => {
      setStatus(event.status, event.errorMessage)
      if (event.sessionId) setSession(event.sessionId)
      if (event.status === 'disconnected') {
        // 清「当前连接」；勿清 thread.agentSessionId（setSession(null) 已保留）
        setSession(null)
        finishStreaming()
        setAuthOpen(false)
        setAuthMethods([])
      }
    })
    const offUpdate = acpApi.onSessionUpdate((event) => {
      if (useAnnotationAgentStore.getState().capturing) {
        useAnnotationAgentStore.getState().applySessionUpdate(event.update)
        return
      }
      applySessionUpdate(event.update)
    })
    return () => {
      offStatus()
      offUpdate()
    }
  }, [applySessionUpdate, finishStreaming, setSession, setStatus])

  const finalizeConnected = useCallback(
    async (result: AcpConnectReadyResult, prefix: string) => {
      setStatus('connected')
      const options = result.configOptions ?? []
      setSession(result.sessionId, options)
      setPromptCapabilities(result.promptCapabilities ?? {})
      appendSystemMessage(formatAcpConnectedMessage(result, prefix))

      const applied = await applyStoredConfigPreferences(
        result.sessionId,
        useAcpUiStore.getState().selectedRuntimeId,
        options,
      )
      if (applied !== options) {
        setConfigOptions(applied)
      }

      if (
        result.requestedSessionId &&
        !result.sessionRestored &&
        (result.restoreAttempts?.length ?? 0) > 0
      ) {
        acpDevWarn('session restore fell back to new', {
          requestedSessionId: result.requestedSessionId,
          newSessionId: result.sessionId,
          restoreAttempts: result.restoreAttempts,
          restoreMethod: result.restoreMethod,
        })
      } else {
        acpDevLog('session ready', {
          sessionId: result.sessionId,
          sessionRestored: result.sessionRestored,
          restoreMethod: result.restoreMethod,
          requestedSessionId: result.requestedSessionId,
        })
      }
    },
    [appendSystemMessage, setConfigOptions, setPromptCapabilities, setSession, setStatus],
  )

  const connect = useCallback(async () => {
    const cwd = workspaceRoot?.trim()
    if (!cwd) {
      appendSystemMessage('请先打开工作区文件夹，再连接 Agent。')
      return
    }
    const statusNow = useAcpUiStore.getState().status
    if (statusNow === 'connecting' || statusNow === 'awaiting_auth') {
      appendSystemMessage('正在连接中，请稍候…')
      return
    }
    setStatus('connecting')
    setAuthError(null)
    const resumeSessionId = activeThreadAgentSessionId()
    appendSystemMessage(
      resumeSessionId
        ? `正在连接 ${selectedRuntimeId}（尝试恢复会话 ${resumeSessionId.slice(0, 8)}…）…`
        : `正在连接 ${selectedRuntimeId}…`,
    )
    const result = await acpApi.connect({
      runtimeId: selectedRuntimeId,
      cwd,
      resumeSessionId,
    })
    if (!isOk(result)) {
      setStatus('error', result.error.message)
      reportAppError(result.error)
      appendSystemMessage(`连接失败：${result.error.message}`)
      return
    }

    if (result.value.phase === 'needs_auth') {
      setStatus('awaiting_auth')
      setAuthMethods(result.value.authMethods)
      setAuthOpen(true)
      appendSystemMessage('需要认证：请选择登录方式')
      return
    }

    await finalizeConnected(result.value, '已连接')
  }, [
    appendSystemMessage,
    finalizeConnected,
    selectedRuntimeId,
    setStatus,
    workspaceRoot,
  ])

  const completeAuth = useCallback(
    async (methodId: string) => {
      setAuthBusy(true)
      setAuthError(null)
      const result = await acpApi.authenticate({ methodId })
      setAuthBusy(false)
      if (!isOk(result)) {
        setAuthError(result.error.message)
        reportAppError(result.error)
        return
      }
      setAuthOpen(false)
      setAuthMethods([])
      await finalizeConnected(result.value, '已认证并连接')
    },
    [finalizeConnected],
  )

  const cancelAuth = useCallback(async () => {
    setAuthOpen(false)
    setAuthMethods([])
    setAuthError(null)
    await acpApi.disconnect()
    setSession(null)
    setStatus('disconnected')
    appendSystemMessage('已取消认证')
  }, [appendSystemMessage, setSession, setStatus])

  const disconnect = useCallback(async () => {
    const result = await acpApi.disconnect()
    if (!isOk(result)) {
      reportAppError(result.error)
      return
    }
    setSession(null)
    setStatus('disconnected')
    finishStreaming()
    setAuthOpen(false)
    appendSystemMessage('已断开连接（本对话会话 id 已保留，重连时可恢复）')
  }, [appendSystemMessage, finishStreaming, setSession, setStatus])

  /**
   * 对齐 Agent 到当前本地线程：离线会自动连接；已连接则按需重连并 resume。
   * - 有 agentSessionId → connect(resume)
   * - 无 agentSessionId → connect(new)
   */
  const syncAgentSessionToActiveThread = useCallback(async (): Promise<boolean> => {
    const cwd = workspaceRoot?.trim()
    const statusNow = useAcpUiStore.getState().status
    if (!cwd) {
      acpDevLog('sync skip: no workspace cwd')
      appendSystemMessage('请先打开工作区文件夹，再使用 Agent。')
      return false
    }
    if (statusNow === 'connecting' || statusNow === 'awaiting_auth') {
      acpDevLog('sync skip: status busy', { statusNow })
      return false
    }
    if (useAcpUiStore.getState().prompting) {
      appendSystemMessage('请先停止当前回合，再切换历史对话。')
      return false
    }

    const resumeSessionId = activeThreadAgentSessionId()
    const liveSessionId = useAcpUiStore.getState().sessionId?.trim() || undefined
    const alreadyAligned =
      statusNow === 'connected' &&
      Boolean(resumeSessionId) &&
      Boolean(liveSessionId) &&
      resumeSessionId === liveSessionId

    if (alreadyAligned) {
      acpDevLog('sync skip: already on target session', { resumeSessionId })
      return true
    }

    const wasOnline = statusNow === 'connected' || statusNow === 'error'
    acpDevLog('sync start', {
      statusNow,
      wasOnline,
      resumeSessionId: resumeSessionId ?? null,
      liveSessionId: liveSessionId ?? null,
      runtimeId: selectedRuntimeId,
      cwd,
    })

    setStatus('connecting')
    setAuthError(null)
    appendSystemMessage(
      resumeSessionId
        ? wasOnline
          ? `正在切换到历史会话 ${resumeSessionId.slice(0, 8)}…`
          : `正在连接并恢复历史会话 ${resumeSessionId.slice(0, 8)}…`
        : wasOnline
          ? '正在为当前对话创建新的 Agent 会话…'
          : `正在连接 ${selectedRuntimeId}…`,
    )

    if (wasOnline) {
      const disconnected = await acpApi.disconnect()
      if (!isOk(disconnected)) {
        acpDevWarn('sync disconnect failed', disconnected.error)
        setStatus('error', disconnected.error.message)
        reportAppError(disconnected.error)
        appendSystemMessage(`切换会话失败：${disconnected.error.message}`)
        return false
      }
      setSession(null)
      finishStreaming()
      setStatus('connecting')
    }

    const result = await acpApi.connect({
      runtimeId: selectedRuntimeId,
      cwd,
      resumeSessionId,
    })
    if (!isOk(result)) {
      acpDevWarn('sync connect failed', result.error)
      setStatus('error', result.error.message)
      reportAppError(result.error)
      appendSystemMessage(`连接失败：${result.error.message}`)
      return false
    }

    if (result.value.phase === 'needs_auth') {
      acpDevLog('sync needs auth', { methods: result.value.authMethods.length })
      setStatus('awaiting_auth')
      setAuthMethods(result.value.authMethods)
      setAuthOpen(true)
      appendSystemMessage('需要认证：请选择登录方式')
      return false
    }

    const prefix = resumeSessionId
      ? wasOnline
        ? '已切换历史会话'
        : '已连接并恢复历史会话'
      : wasOnline
        ? '已为当前对话新建会话'
        : '已连接'

    await finalizeConnected(result.value, prefix)
    acpDevLog('sync done', {
      sessionId: result.value.sessionId,
      sessionRestored: result.value.sessionRestored,
      restoreAttempts: result.value.restoreAttempts,
    })
    return true
  }, [
    appendSystemMessage,
    finalizeConnected,
    finishStreaming,
    selectedRuntimeId,
    setSession,
    setStatus,
    workspaceRoot,
  ])

  const sendPrompt = useCallback(
    async (payload: {
      text: string
      prompt: AcpContentBlock[]
      messageAttachments?: AcpMessageAttachment[]
    }) => {
      if (useAcpUiStore.getState().prompting) return
      if (!payload.prompt.length) return

      let sid = useAcpUiStore.getState().sessionId
      if (!sid) {
        acpDevLog('sendPrompt: offline, auto-connect before send')
        const ok = await syncAgentSessionToActiveThread()
        sid = useAcpUiStore.getState().sessionId
        if (!ok || !sid) {
          appendSystemMessage('自动连接未完成，请检查工作区或完成认证后再发送。')
          return
        }
      }

      appendUserMessage(payload.text, payload.messageAttachments)
      setPrompting(true)
      beginAgentReply()
      const prefix = buildInkdownPromptPrefix(useAcpUiStore.getState().activeThreadId)
      const result = await acpApi.prompt({
        sessionId: sid,
        prompt: [...prefix, ...payload.prompt],
      })
      finishStreaming()
      if (!isOk(result)) {
        reportAppError(result.error)
        appendSystemMessage(`发送失败：${result.error.message}`)
        return
      }
      if (result.value.stopReason && result.value.stopReason !== 'end_turn') {
        appendSystemMessage(`回合结束：${result.value.stopReason}`)
      }
    },
    [
      appendSystemMessage,
      appendUserMessage,
      beginAgentReply,
      finishStreaming,
      setPrompting,
      syncAgentSessionToActiveThread,
    ],
  )

  /** 清空时间线等于重新开场：turn-context 计数一并归零 */
  const clearMessages = useCallback(() => {
    resetTurnContextTracker(useAcpUiStore.getState().activeThreadId)
    clearMessagesInStore()
  }, [clearMessagesInStore])

  const cancel = useCallback(async () => {
    const sid = useAcpUiStore.getState().sessionId
    if (!sid) return
    const result = await acpApi.cancel({ sessionId: sid })
    if (!isOk(result)) {
      reportAppError(result.error)
      return
    }
    useAcpUiStore.getState().clearPendingPermission()
    finishStreaming()
  }, [finishStreaming])

  const setModel = useCallback(
    async (configId: string, value: string) => {
      const sid = useAcpUiStore.getState().sessionId
      if (!sid) return
      const runtimeId = useAcpUiStore.getState().selectedRuntimeId
      const result = await acpApi.setConfigOption({ sessionId: sid, configId, value })
      if (!isOk(result)) {
        reportAppError(result.error)
        appendSystemMessage(`切换配置失败：${result.error.message}`)
        return
      }
      rememberConfigPreference(runtimeId, configId, value)
      if (result.value.configOptions.length > 0) {
        setConfigOptions(result.value.configOptions)
      }
    },
    [appendSystemMessage, rememberConfigPreference, setConfigOptions],
  )

  return {
    connect,
    disconnect,
    syncAgentSessionToActiveThread,
    sendPrompt,
    cancel,
    setModel,
    clearMessages,
    sessionId,
    prompting,
    authOpen,
    authMethods,
    authBusy,
    authError,
    completeAuth,
    cancelAuth,
  }
}
