import { useCallback, useState } from 'react'
import { isOk } from '@shared/core/result'
import { acpApi } from '@/api/acp-api'
import { buildInkdownPromptPrefix } from '@/lib/agent/context/build-prompt-prefix'
import { proposeNoteForAgent } from '@/lib/agent/context/propose-note-for-agent'
import {
  ANNOTATION_DIRECTION_ASK,
  buildAnnotationChatPrompt,
  buildAnnotationComposePrompt,
  buildAnnotationRefinePrompt,
  detectAnnotationWriteIntent,
  extractAnnotationDraft,
  type AnnotationIntentId,
  type AnnotationRefineId,
} from '@/lib/agent/annotation-note-prompts'
import { listPreferredConfigPatches } from '@/lib/agent/acp-config-preferences'
import { reportAppError } from '@/lib/workspace/report-error'
import {
  annotationFileKey,
  useAnnotationAgentStore,
} from '@/stores/annotation-agent-store'
import { useAcpUiStore } from '@/stores/acp-ui-store'
import { toast } from 'sonner'

function resolveWorkspaceCwd(): string | undefined {
  const s = useAcpUiStore.getState()
  const active = s.threads.find((t) => t.id === s.activeThreadId)
  const fromActive = active?.workspaceRoot?.trim()
  if (fromActive) return fromActive
  for (const thread of s.threads) {
    const root = thread.workspaceRoot?.trim()
    if (root) return root
  }
  return undefined
}

function activeAnnotationAgentSessionId(fileKey: string): string | null {
  const s = useAnnotationAgentStore.getState()
  const file = s.byFileKey[fileKey]
  if (!file) return null
  const thread = file.threads.find((t) => t.id === file.activeThreadId)
  return thread?.agentSessionId?.trim() || null
}

/**
 * 批注助手：独立 ACP session（与右侧 Agent 时间线 / 记忆隔离）。
 * 仅复用同一 Agent 进程连接；会话、历史互不互通。
 */
export function useAnnotationAgentAssist(options: {
  filePath: string
  fileFingerprint: string
  excerpt: string
}) {
  const status = useAcpUiStore((s) => s.status)
  const annotationPrompting = useAnnotationAgentStore((s) => s.prompting)
  const mainPrompting = useAcpUiStore((s) => s.prompting)
  const phase = useAnnotationAgentStore((s) => s.phase)
  const pendingDraft = useAnnotationAgentStore((s) => s.pendingDraft)
  const timelineOpen = useAnnotationAgentStore((s) => s.timelineOpen)
  const [composeHint, setComposeHint] = useState(false)
  const [awaitingDirection, setAwaitingDirection] = useState(false)

  const fileKey = annotationFileKey(options.fileFingerprint, options.filePath)
  /** 只需 Agent 进程已连接；不必占用右侧主 session */
  const agentReady = status === 'connected'
  const busy = annotationPrompting || mainPrompting

  const prepare = useCallback(() => {
    useAnnotationAgentStore.getState().ensureFile(fileKey)
    useAnnotationAgentStore.getState().setTimelineOpen(true)
  }, [fileKey])

  /** 为当前书的当前批注线程拿到专属 sessionId（没有则 session/new） */
  const ensureAnnotationSession = useCallback(async (): Promise<string | null> => {
    prepare()
    if (useAcpUiStore.getState().status !== 'connected') {
      toast.message('请先连接 AI')
      return null
    }

    const existing = activeAnnotationAgentSessionId(fileKey)
    if (existing) return existing

    // cwd 可省略：主进程用 connect 时的 workspaceRoot 兜底
    // （ACP 线程上的 workspaceRoot 可能为空，不代表没开工作区）
    const created = await acpApi.sessionNew({ cwd: resolveWorkspaceCwd() })
    if (!isOk(created)) {
      reportAppError(created.error)
      return null
    }

    useAnnotationAgentStore.getState().bindSessionId(created.value.sessionId)

    const runtimeId = useAcpUiStore.getState().selectedRuntimeId
    const preferred =
      useAcpUiStore.getState().preferredConfigByRuntime[runtimeId] ?? undefined
    const patches = listPreferredConfigPatches(
      created.value.configOptions ?? [],
      preferred,
    )
    for (const patch of patches) {
      await acpApi.setConfigOption({
        sessionId: created.value.sessionId,
        configId: patch.configId,
        value: patch.value,
      })
    }

    return created.value.sessionId
  }, [fileKey, prepare])

  const runPrompt = useCallback(
    async (
      displayText: string,
      promptText: string,
      mode: 'chat' | 'compose' | 'refine',
    ) => {
      prepare()
      const store = useAnnotationAgentStore.getState()
      if (store.prompting) return false
      if (useAcpUiStore.getState().prompting) {
        toast.message('右侧 AI 忙碌中，请稍后再试批注助手')
        return false
      }

      const sid = await ensureAnnotationSession()
      if (!sid) return false

      store.setCapturing(true)
      store.setPrompting(true)
      if (mode === 'compose' || mode === 'refine') store.setPhase('generating')
      store.appendUserMessage(displayText)
      store.beginAgentReply()

      const prefix = buildInkdownPromptPrefix(`annotation:${fileKey}`)
      const result = await acpApi.prompt({
        sessionId: sid,
        prompt: [...prefix, { type: 'text', text: promptText }],
      })

      store.finishStreaming()
      store.setCapturing(false)

      if (!isOk(result)) {
        // 会话可能已失效：清绑定，下次重建
        if (
          result.error.code === 'ACP_PROTOCOL_ERROR' ||
          result.error.code === 'ACP_NOT_CONNECTED'
        ) {
          useAnnotationAgentStore.getState().bindSessionId(null)
        }
        reportAppError(result.error)
        store.setPhase(store.pendingDraft ? 'editing' : 'idle')
        return false
      }

      if (mode === 'chat') {
        store.setPhase(store.pendingDraft ? 'editing' : 'idle')
        setComposeHint(true)
        return true
      }

      const draft = extractAnnotationDraft(
        useAnnotationAgentStore.getState().lastAgentText(),
      )
      if (!draft) {
        store.setPhase(store.pendingDraft ? 'editing' : 'idle')
        toast.message('没整理出可用批注正文，请再说一下想怎么写')
        return false
      }

      await proposeNoteForAgent(draft, {
        openConfirmUi: false,
        excerpt: options.excerpt,
        filePath: options.filePath,
        fileFingerprint: options.fileFingerprint,
      })
      setComposeHint(false)
      setAwaitingDirection(false)
      return true
    },
    [
      ensureAnnotationSession,
      fileKey,
      options.excerpt,
      options.fileFingerprint,
      options.filePath,
      prepare,
    ],
  )

  const composeNote = useCallback(
    async (hint?: string) => {
      setAwaitingDirection(false)
      setComposeHint(false)
      const built = buildAnnotationComposePrompt({
        excerpt: options.excerpt,
        hint,
      })
      await runPrompt(built.displayText, built.promptText, 'compose')
    },
    [options.excerpt, runPrompt],
  )

  /** 「写成批注」：命令已明确，直接整理（方向可选，空白=默认） */
  const writeNoteNow = useCallback(
    async (hint?: string) => {
      if (!agentReady) {
        toast.message('请先连接 AI')
        return
      }
      await composeNote(hint?.trim() || undefined)
    },
    [agentReady, composeNote],
  )

  /** 「换个方向」：可选补方向；空白也可直接生成 */
  const requestComposeDirection = useCallback(() => {
    if (!agentReady) {
      toast.message('请先连接 AI')
      return
    }
    if (useAnnotationAgentStore.getState().prompting || useAcpUiStore.getState().prompting) {
      toast.message('AI 忙碌中，请稍后再试')
      return
    }
    prepare()
    const store = useAnnotationAgentStore.getState()
    store.appendUserMessage('换个方向再写')
    store.appendAgentMessage(ANNOTATION_DIRECTION_ASK)
    setAwaitingDirection(true)
    setComposeHint(false)
  }, [agentReady, prepare])

  const sendChat = useCallback(
    async (intent: AnnotationIntentId, customText?: string) => {
      if (intent === 'custom') {
        const text = customText?.trim() ?? ''

        // 等待方向时：空白也算确认「按默认写」
        if (awaitingDirection) {
          setAwaitingDirection(false)
          await composeNote(text || undefined)
          return
        }

        if (text) {
          const detected = detectAnnotationWriteIntent(text)
          if (detected.write) {
            // 「写批注」本身即明确命令；有方向带上，没有就默认写
            await composeNote(detected.hasDirection ? detected.direction : undefined)
            return
          }
        }
      }

      const built = buildAnnotationChatPrompt({
        excerpt: options.excerpt,
        intent,
        customText,
      })
      await runPrompt(built.displayText, built.promptText, 'chat')
    },
    [awaitingDirection, composeNote, options.excerpt, runPrompt],
  )

  const runRefine = useCallback(
    async (refine: AnnotationRefineId) => {
      const draft = useAnnotationAgentStore.getState().pendingDraft
      if (!draft?.note.trim()) return
      const built = buildAnnotationRefinePrompt({
        excerpt: options.excerpt || draft.excerpt,
        draft: draft.note,
        refine,
        lastIntentLabel: draft.lastIntentLabel,
      })
      await runPrompt(built.displayText, built.promptText, 'refine')
    },
    [options.excerpt, runPrompt],
  )

  /** 新会话：本地新线程 + 下次 prompt 再建 ACP session（不碰右侧历史） */
  const newSession = useCallback(() => {
    useAnnotationAgentStore.getState().createThread(fileKey)
    setComposeHint(false)
    setAwaitingDirection(false)
  }, [fileKey])

  return {
    fileKey,
    agentReady,
    busy,
    phase,
    pendingDraft,
    timelineOpen,
    composeHint,
    awaitingDirection,
    dismissComposeHint: () => setComposeHint(false),
    prepare,
    sendChat,
    composeNote,
    writeNoteNow,
    requestComposeDirection,
    runRefine,
    newSession,
    discardDraft: () => useAnnotationAgentStore.getState().discardDraft(),
    updatePendingNote: (note: string) =>
      useAnnotationAgentStore.getState().updatePendingNote(note),
  }
}
