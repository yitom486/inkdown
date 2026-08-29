import { useCallback, useEffect, useState } from 'react'
import { isOk } from '@shared/core/result'
import type { AcpAuthMethod } from '@shared/types/acp'
import { acpApi } from '@/api/acp-api'
import { reportAppError } from '@/lib/report-error'
import { useAcpUiStore } from '@/stores/acp-ui-store'

export function useAcpSession(workspaceRoot?: string) {
  const setStatus = useAcpUiStore((s) => s.setStatus)
  const setSession = useAcpUiStore((s) => s.setSession)
  const setConfigOptions = useAcpUiStore((s) => s.setConfigOptions)
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

  const connect = useCallback(async () => {
    const cwd = workspaceRoot?.trim()
    if (!cwd) {
      appendSystemMessage('请先打开工作区文件夹，再连接 Agent。')
      return
    }
    setStatus('connecting')
    setAuthError(null)
    appendSystemMessage(`正在连接 ${selectedRuntimeId}…`)
    const result = await acpApi.connect({ runtimeId: selectedRuntimeId, cwd })
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

    setSession(result.value.sessionId, result.value.configOptions ?? [])
    setStatus('connected')
    appendSystemMessage(
      `已连接${result.value.agentName ? `（${result.value.agentName}）` : ''}，会话 ${result.value.sessionId}`,
    )
  }, [
    appendSystemMessage,
    selectedRuntimeId,
    setSession,
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
      setSession(result.value.sessionId, result.value.configOptions ?? [])
      setStatus('connected')
      appendSystemMessage(
        `已认证并连接${result.value.agentName ? `（${result.value.agentName}）` : ''}，会话 ${result.value.sessionId}`,
      )
    },
    [appendSystemMessage, setSession, setStatus],
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
    appendSystemMessage('已断开连接')
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
    finishStreaming()
  }, [finishStreaming])

  const setModel = useCallback(
    async (configId: string, value: string) => {
      const sid = useAcpUiStore.getState().sessionId
      if (!sid) return
      const result = await acpApi.setConfigOption({ sessionId: sid, configId, value })
      if (!isOk(result)) {
        reportAppError(result.error)
        appendSystemMessage(`切换模型失败：${result.error.message}`)
        return
      }
      if (result.value.configOptions.length > 0) {
        setConfigOptions(result.value.configOptions)
      }
    },
    [appendSystemMessage, setConfigOptions],
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
