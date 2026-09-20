import { useCallback, useEffect, useRef, useState } from 'react'
import { isOk } from '@inkdown/contracts'
import type {
  AcpAuthMethod,
  AcpConfigOption,
  AcpConnectReadyResult,
  AcpContentBlock,
} from '@inkdown/contracts'
import type { AcpMessageAttachment } from '@/lib/agent/acp-composer'
import { acpApi } from '@/api/acp-api'
import { buildInkdownPromptPrefix } from '@/lib/agent/context/build-prompt-prefix'
import {
  markSessionBootstrapSent,
  shouldSendSessionBootstrap,
} from '@/lib/agent/context/session-bootstrap'
import { resetTurnContextTracker } from '@/lib/agent/context/should-attach-turn-context'
import { listPreferredConfigPatches } from '@/lib/agent/acp-config-preferences'
import { acpDevLog, acpDevWarn } from '@/lib/agent/acp-dev-log'
import { STREAM_FLUSH_MS, StreamCoalescer, isCoalescableAgentChunk } from '@/lib/agent/stream-coalescer'
import { formatAcpConnectedMessage } from '@/lib/agent/acp-session-restore'
import { selectActiveThreadAgentSessionId } from '@/stores/acp-ui-store'
import { reportAppError } from '@/lib/workspace/report-error'
import { useAcpUiStore } from '@/stores/acp-ui-store'
import { useAnnotationAgentStore, annotationOwnsSessionId } from '@/stores/annotation-agent-store'
import { quizOwnsSessionId, accumulateQuizSessionUpdate, isQuizPrompting } from '@/lib/quiz/quiz-acp-session'
import { tocOwnsSessionId, accumulateTocSessionUpdate, isTocPrompting } from '@/lib/agent/toc-ai-session'
import {
  cardStudioOwnsSessionId,
  accumulateCardStudioSessionUpdate,
  isCardStudioPrompting,
} from '@/lib/agent/card-studio-session'

function activeThreadAgentSessionId(): string | undefined {
  return selectActiveThreadAgentSessionId(useAcpUiStore.getState())
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
  /** 弹窗内 methods 归属的运行时：completeAuth 前必须与当前选中一致，防止串 runtime */
  const [authRuntimeId, setAuthRuntimeId] = useState<string | null>(null)

  /**
   * 连接代际：connect / switchRuntime / sync / disconnect 任一新流程启动即 +1。
   * 渲染端此前对滞后 IPC 响应无任何防线——旧运行时的 needs_auth 会盖掉新连接的
   * connected（标题读 live selectedRuntimeId，methods 却是旧的），必须丢弃。
   */
  const connectionEpochRef = useRef(0)
  const bumpConnectionEpoch = useCallback(() => {
    connectionEpochRef.current += 1
    return connectionEpochRef.current
  }, [])

  // 接收缓冲提到 hook 级：结束/cancel/断开路径必须先冲刷再 finishStreaming，
  // 否则尾部 chunk 可能丢失或错序
  const chunkBufferRef = useRef<{ coalescer: StreamCoalescer; timer: ReturnType<typeof setTimeout> | null } | null>(null)
  const flushBufferedChunks = useCallback(() => {
    const buf = chunkBufferRef.current
    if (!buf) return
    if (buf.timer) {
      clearTimeout(buf.timer)
      buf.timer = null
    }
    const text = buf.coalescer.flush()
    if (text) {
      useAcpUiStore.getState().applySessionUpdate({
        sessionUpdate: 'agent_message_chunk',
        content: [{ type: 'text', text }],
      })
    }
  }, [])

  useEffect(() => {
    // 正文 chunk 先缓冲、按帧合并提交；工具/权限/结束等保留顺序、立即冲刷
    const buf = { coalescer: new StreamCoalescer(), timer: null as ReturnType<typeof setTimeout> | null }
    chunkBufferRef.current = buf
    const scheduleFlush = () => {
      if (buf.timer) return
      buf.timer = setTimeout(() => flushBufferedChunks(), STREAM_FLUSH_MS)
    }
    const offStatus = acpApi.onStatusChanged((event) => {
      setStatus(event.status, event.errorMessage)
      if (event.sessionId) setSession(event.sessionId)
      if (event.status === 'disconnected') {
        // 清「当前连接」；勿清 thread.agentSessionIds（setSession(null) 已按运行时保留）
        setSession(null)
        flushBufferedChunks()
        finishStreaming()
        setAuthOpen(false)
        setAuthMethods([])
        setAuthRuntimeId(null)
        // 批注：保留 agentSessionIds，仅标记 stale，重连后 session/load 续上
        useAnnotationAgentStore.getState().markSessionsStale()
      }
    })
    const offUpdate = acpApi.onSessionUpdate((event) => {
      const ann = useAnnotationAgentStore.getState()
      // 按 sessionId 分流：批注副会话绝不进右侧时间线
      if (annotationOwnsSessionId(ann, event.sessionId)) {
        ann.applySessionUpdate(event.update)
        return
      }
      // 兼容：副会话刚创建、尚未 bind 前的短窗口
      if (ann.capturing) {
        ann.applySessionUpdate(event.update)
        return
      }
      // 按 sessionId 分流：考官副会话或出题判卷期间绝不进右侧时间线
      if (quizOwnsSessionId(event.sessionId) || isQuizPrompting()) {
        accumulateQuizSessionUpdate(event.sessionId, event.update)
        return
      }
      // 按 sessionId 分流：目录 AI 整理副会话绝不进右侧时间线
      if (tocOwnsSessionId(event.sessionId) || isTocPrompting()) {
        accumulateTocSessionUpdate(event.sessionId, event.update)
        return
      }
      // 按 sessionId 分流：制卡副会话（一书一会话）绝不进右侧时间线
      if (cardStudioOwnsSessionId(event.sessionId) || isCardStudioPrompting()) {
        accumulateCardStudioSessionUpdate(event.sessionId, event.update)
        return
      }
      const chunkText = isCoalescableAgentChunk(event.update)
      if (chunkText) {
        chunkBufferRef.current?.coalescer.push(chunkText)
        scheduleFlush()
        return
      }
      flushBufferedChunks()
      applySessionUpdate(event.update)
    })
    return () => {
      flushBufferedChunks()
      offStatus()
      offUpdate()
    }
  }, [applySessionUpdate, finishStreaming, flushBufferedChunks, setSession, setStatus])

  const finalizeConnected = useCallback(
    async (result: AcpConnectReadyResult, prefix: string) => {
      setStatus('connected')
      // 成功即收掉可能残留的认证弹窗（滞后 needs_auth 不应再出现，见 epoch 防线）
      setAuthOpen(false)
      setAuthMethods([])
      setAuthRuntimeId(null)
      setAuthError(null)
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
    const cwd = workspaceRoot?.trim() || undefined
    const statusNow = useAcpUiStore.getState().status
    if (statusNow === 'connecting' || statusNow === 'awaiting_auth') {
      appendSystemMessage('正在连接中，请稍候…')
      return
    }
    const epoch = bumpConnectionEpoch()
    setStatus('connecting')
    setAuthError(null)
    const resumeSessionId = activeThreadAgentSessionId()
    appendSystemMessage(
      resumeSessionId
        ? `正在连接 ${selectedRuntimeId}（尝试恢复会话 ${resumeSessionId.slice(0, 8)}…）…`
        : `正在连接 ${selectedRuntimeId}${cwd ? '' : '（网页会话）'}…`,
    )
    const result = await acpApi.connect({
      runtimeId: selectedRuntimeId,
      cwd,
      resumeSessionId,
    })
    // 滞后响应：连接期间用户已切走（新流程 bump 了 epoch），一律丢弃
    if (epoch !== connectionEpochRef.current) return
    if (!isOk(result)) {
      setStatus('error', result.error.message, result.error.code)
      reportAppError(result.error)
      appendSystemMessage(`连接失败：${result.error.message}`)
      return
    }

    if (result.value.phase === 'needs_auth') {
      // 防串 runtime：只接受归属当前选中运行时的认证请求
      if (result.value.runtimeId !== useAcpUiStore.getState().selectedRuntimeId) return
      setStatus('awaiting_auth')
      setAuthMethods(result.value.authMethods)
      setAuthRuntimeId(result.value.runtimeId)
      setAuthOpen(true)
      appendSystemMessage('需要认证：请选择登录方式')
      return
    }

    await finalizeConnected(result.value, '已连接')
  }, [
    appendSystemMessage,
    bumpConnectionEpoch,
    finalizeConnected,
    selectedRuntimeId,
    setStatus,
    workspaceRoot,
  ])

  const completeAuth = useCallback(
    async (methodId: string) => {
      // 弹窗打开后用户可能已切换 Agent：归属不一致则拒绝，避免把旧方式发给新服务端
      if (
        authRuntimeId !== null &&
        authRuntimeId !== useAcpUiStore.getState().selectedRuntimeId
      ) {
        setAuthError('已切换 Agent，该登录方式已过期，请重新连接。')
        return
      }
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
      setAuthRuntimeId(null)
      await finalizeConnected(result.value, '已认证并连接')
    },
    [authRuntimeId, finalizeConnected],
  )

  const cancelAuth = useCallback(async () => {
    bumpConnectionEpoch()
    setAuthOpen(false)
    setAuthMethods([])
    setAuthRuntimeId(null)
    setAuthError(null)
    await acpApi.disconnect()
    setSession(null)
    setStatus('disconnected')
    appendSystemMessage('已取消认证')
  }, [appendSystemMessage, bumpConnectionEpoch, setSession, setStatus])

  const disconnect = useCallback(async () => {
    bumpConnectionEpoch()
    const result = await acpApi.disconnect()
    if (!isOk(result)) {
      reportAppError(result.error)
      return
    }
    setSession(null)
    setStatus('disconnected')
    flushBufferedChunks()
    finishStreaming()
    setAuthOpen(false)
    appendSystemMessage('已断开连接（本对话会话 id 已保留，重连时可恢复）')
  }, [appendSystemMessage, bumpConnectionEpoch, finishStreaming, flushBufferedChunks, setSession, setStatus])

  /**
   * 切换 ACP 运行时（如在 codex-acp 与 antigravity-acp 间切换）：
   * 若当前正处于连接态，会自动断开旧运行时并立即连接新运行时。
   */
  const switchRuntime = useCallback(
    async (nextRuntimeId: string) => {
      const current = useAcpUiStore.getState().selectedRuntimeId
      if (!nextRuntimeId || nextRuntimeId === current) return
      useAcpUiStore.getState().setSelectedRuntimeId(nextRuntimeId)
      const statusNow = useAcpUiStore.getState().status
      if (
        statusNow === 'connected' ||
        statusNow === 'connecting' ||
        statusNow === 'awaiting_auth'
      ) {
        await disconnect()
        // disconnect 内部已 bump epoch，此处重新捕获，之后只认本流程的响应
        const epoch = bumpConnectionEpoch()
        const cwd = workspaceRoot?.trim() || undefined
        setStatus('connecting')
        setAuthError(null)
        const resumeSessionId = activeThreadAgentSessionId()
        appendSystemMessage(
          resumeSessionId
            ? `正在切换至 ${nextRuntimeId}（尝试恢复会话 ${resumeSessionId.slice(0, 8)}…）…`
            : `正在切换至 ${nextRuntimeId}${cwd ? '' : '（网页会话）'}…`,
        )
        const result = await acpApi.connect({
          runtimeId: nextRuntimeId,
          cwd,
          resumeSessionId,
        })
        if (epoch !== connectionEpochRef.current) return
        if (!isOk(result)) {
          setStatus('error', result.error.message, result.error.code)
          reportAppError(result.error)
          appendSystemMessage(`连接失败：${result.error.message}`)
          return
        }

        if (result.value.phase === 'needs_auth') {
          // 防串 runtime：旧流程滞后返回的 needs_auth 直接丢弃
          if (result.value.runtimeId !== useAcpUiStore.getState().selectedRuntimeId) return
          setStatus('awaiting_auth')
          setAuthMethods(result.value.authMethods)
          setAuthRuntimeId(result.value.runtimeId)
          setAuthOpen(true)
          appendSystemMessage('需要认证：请选择登录方式')
          return
        }

        await finalizeConnected(result.value, `已连接至 ${nextRuntimeId}`)
      }
    },
    [appendSystemMessage, bumpConnectionEpoch, disconnect, finalizeConnected, setStatus, workspaceRoot],
  )

  /**
   * 对齐 Agent 到当前本地线程：离线会自动连接；已连接则按需重连并 resume。
   * - 当前运行时下有 agentSessionIds[id] → connect(resume)
   * - 无 → connect(new)（换运行时后旧会话不会跨 Agent 串线）
   * @param forceReconnect 工作区 cwd 变更时强制重连（即使 sessionId 已对齐）
   */
  const syncAgentSessionToActiveThread = useCallback(async (
    forceReconnect = false,
  ): Promise<boolean> => {
    const cwd = workspaceRoot?.trim() || undefined
    const statusNow = useAcpUiStore.getState().status
    if (statusNow === 'connecting' || statusNow === 'awaiting_auth') {
      acpDevLog('sync skip: status busy', { statusNow })
      return false
    }
    if (useAcpUiStore.getState().prompting) {
      appendSystemMessage('请先停止当前回合，再切换历史对话。')
      return false
    }

    const epoch = bumpConnectionEpoch()
    const resumeSessionId = activeThreadAgentSessionId()
    const liveSessionId = useAcpUiStore.getState().sessionId?.trim() || undefined
    const alreadyAligned =
      !forceReconnect &&
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
      forceReconnect,
      resumeSessionId: resumeSessionId ?? null,
      liveSessionId: liveSessionId ?? null,
      runtimeId: selectedRuntimeId,
      cwd: cwd ?? '(sandbox)',
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
          : `正在连接 ${selectedRuntimeId}${cwd ? '' : '（网页会话）'}…`,
    )

    if (wasOnline) {
      const disconnected = await acpApi.disconnect()
      if (!isOk(disconnected)) {
        acpDevWarn('sync disconnect failed', disconnected.error)
        setStatus('error', disconnected.error.message, disconnected.error.code)
        reportAppError(disconnected.error)
        appendSystemMessage(`切换会话失败：${disconnected.error.message}`)
        return false
      }
      setSession(null)
      flushBufferedChunks()
      finishStreaming()
      setStatus('connecting')
    }

    const result = await acpApi.connect({
      runtimeId: selectedRuntimeId,
      cwd,
      resumeSessionId,
    })
    if (epoch !== connectionEpochRef.current) return false
    if (!isOk(result)) {
      acpDevWarn('sync connect failed', result.error)
      setStatus('error', result.error.message, result.error.code)
      reportAppError(result.error)
      appendSystemMessage(`连接失败：${result.error.message}`)
      return false
    }

    if (result.value.phase === 'needs_auth') {
      if (result.value.runtimeId !== useAcpUiStore.getState().selectedRuntimeId) {
        // 滞后于切换的旧响应：静默丢弃
        return false
      }
      acpDevLog('sync needs auth', { methods: result.value.authMethods.length })
      setStatus('awaiting_auth')
      setAuthMethods(result.value.authMethods)
      setAuthRuntimeId(result.value.runtimeId)
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
    bumpConnectionEpoch,
    finalizeConnected,
    finishStreaming,
    flushBufferedChunks,
    selectedRuntimeId,
    setSession,
    setStatus,
    workspaceRoot,
  ])

  /** 打开 / 关闭用户工作区时，已连接会话需换 cwd（沙箱 ↔ 本地目录） */
  const cwdKeyRef = useRef<string | undefined>(undefined)
  const cwdReadyRef = useRef(false)
  useEffect(() => {
    const next = workspaceRoot?.trim() || undefined
    if (!cwdReadyRef.current) {
      cwdReadyRef.current = true
      cwdKeyRef.current = next
      return
    }
    if (cwdKeyRef.current === next) return
    cwdKeyRef.current = next
    if (useAcpUiStore.getState().status !== 'connected') return
    if (useAcpUiStore.getState().prompting) return
    appendSystemMessage(
      next
        ? '已打开本地工作区，正在将 Agent 切到该目录…'
        : '本地工作区已关闭，正在切换为网页会话…',
    )
    void syncAgentSessionToActiveThread(true)
  }, [appendSystemMessage, syncAgentSessionToActiveThread, workspaceRoot])

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
          appendSystemMessage('自动连接未完成，请完成认证后再发送。')
          return
        }
      }

      appendUserMessage(payload.text, payload.messageAttachments)
      setPrompting(true)
      beginAgentReply()
      const includeBootstrap = shouldSendSessionBootstrap(sid)
      const prefix = buildInkdownPromptPrefix(useAcpUiStore.getState().activeThreadId, {
        includeBootstrap,
      })
      const result = await acpApi.prompt({
        sessionId: sid,
        prompt: [...prefix, ...payload.prompt],
      })
      if (isOk(result) && includeBootstrap) {
        markSessionBootstrapSent(sid)
      }
      flushBufferedChunks()
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
      flushBufferedChunks,
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
    flushBufferedChunks()
    finishStreaming()
  }, [finishStreaming, flushBufferedChunks])

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
    switchRuntime,
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
