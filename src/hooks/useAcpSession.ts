import { useCallback, useEffect, useState } from 'react'
import { isOk } from '@shared/core/result'
import type { AcpAuthMethod, AcpConfigOption, AcpConnectReadyResult } from '@shared/types/acp'
import { acpApi } from '@/api/acp-api'
import { listPreferredConfigPatches } from '@/lib/acp-config-preferences'
import { formatAcpConnectedMessage } from '@/lib/acp-session-restore'
import { reportAppError } from '@/lib/report-error'
import { useAcpUiStore } from '@/stores/acp-ui-store'

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
  const clearMessages = useAcpUiStore((s) => s.clearMessages)
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
        console.warn('[acp-ui] session restore fell back to new', result)
      }
    },
    [appendSystemMessage, setConfigOptions, setSession, setStatus],
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

  const sendPrompt = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      const sid = useAcpUiStore.getState().sessionId
      if (!sid) {
        appendSystemMessage('尚未连接 Agent，请先点击连接。')
        return
      }
      if (useAcpUiStore.getState().prompting) return

      appendUserMessage(trimmed)
      setPrompting(true)
      beginAgentReply()
      const result = await acpApi.prompt({ sessionId: sid, text: trimmed })
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
    ],
  )

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
