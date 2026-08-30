import { useCallback } from 'react'
import { isOk } from '@shared/core/result'
import { acpApi } from '@/api/acp-api'
import { buildInkdownPromptPrefix } from '@/lib/agent/context/build-prompt-prefix'
import {
  buildAnnotationIntentPrompt,
  buildAnnotationRefinePrompt,
  type AnnotationIntentId,
  type AnnotationRefineId,
} from '@/lib/agent/annotation-note-prompts'
import { reportAppError } from '@/lib/workspace/report-error'
import {
  annotationFileKey,
  useAnnotationAgentStore,
} from '@/stores/annotation-agent-store'
import { useAcpUiStore } from '@/stores/acp-ui-store'
import { toast } from 'sonner'

/**
 * 批注助手：复用当前 ACP 连接发送 prompt。
 * sessionUpdate 经 useAcpSession 的 capturing 路由写入 annotation-agent-store，
 * 不在此再挂监听（避免与 AgentPanel 双订阅）。
 */
export function useAnnotationAgentAssist(options: {
  filePath: string
  fileFingerprint: string
  excerpt: string
}) {
  const status = useAcpUiStore((s) => s.status)
  const sessionId = useAcpUiStore((s) => s.sessionId)
  const mainPrompting = useAcpUiStore((s) => s.prompting)
  const annotationPrompting = useAnnotationAgentStore((s) => s.prompting)
  const phase = useAnnotationAgentStore((s) => s.phase)
  const pendingDraft = useAnnotationAgentStore((s) => s.pendingDraft)
  const timelineOpen = useAnnotationAgentStore((s) => s.timelineOpen)

  const fileKey = annotationFileKey(options.fileFingerprint, options.filePath)
  const agentReady = status === 'connected' && Boolean(sessionId)
  const busy = mainPrompting || annotationPrompting

  const prepare = useCallback(() => {
    useAnnotationAgentStore.getState().ensureFile(fileKey)
  }, [fileKey])

  const runPrompt = useCallback(
    async (displayText: string, promptText: string, intentLabel: string) => {
      prepare()
      const store = useAnnotationAgentStore.getState()
      if (store.prompting || useAcpUiStore.getState().prompting) return

      const sid = useAcpUiStore.getState().sessionId
      if (!sid || useAcpUiStore.getState().status !== 'connected') {
        toast.message('请先连接右侧 Agent，再使用 AI 写批注')
        return
      }

      store.setCapturing(true)
      store.setPrompting(true)
      store.setPhase('generating')
      useAcpUiStore.getState().setPrompting(true)
      store.bindSessionId(sid)
      store.appendUserMessage(displayText)
      store.beginAgentReply()

      const prefix = buildInkdownPromptPrefix(`annotation:${fileKey}`)
      const result = await acpApi.prompt({
        sessionId: sid,
        prompt: [...prefix, { type: 'text', text: promptText }],
      })

      store.finishStreaming()
      store.setCapturing(false)
      useAcpUiStore.getState().setPrompting(false)

      if (!isOk(result)) {
        reportAppError(result.error)
        store.setPhase(store.pendingDraft ? 'ready' : 'idle')
        return
      }

      const draft = useAnnotationAgentStore.getState().lastAgentText()
      if (!draft) {
        store.setPhase(store.pendingDraft ? 'ready' : 'idle')
        toast.message('没有得到可用草稿，请换一种意图再试')
        return
      }

      store.setPendingDraft({
        fileKey,
        excerpt: options.excerpt,
        note: draft,
        source: 'ai',
        lastIntentLabel: intentLabel,
      })
      store.setPhase('ready')
    },
    [fileKey, options.excerpt, prepare],
  )

  const runIntent = useCallback(
    async (intent: AnnotationIntentId, customText?: string) => {
      const built = buildAnnotationIntentPrompt({
        excerpt: options.excerpt,
        intent,
        customText,
      })
      await runPrompt(built.displayText, built.promptText, built.displayText)
    },
    [options.excerpt, runPrompt],
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
      await runPrompt(
        built.displayText,
        built.promptText,
        draft.lastIntentLabel ?? built.displayText,
      )
    },
    [options.excerpt, runPrompt],
  )

  const newSession = useCallback(() => {
    useAnnotationAgentStore.getState().createThread(fileKey)
  }, [fileKey])

  return {
    fileKey,
    agentReady,
    busy,
    phase,
    pendingDraft,
    timelineOpen,
    prepare,
    runIntent,
    runRefine,
    newSession,
    discardDraft: () => useAnnotationAgentStore.getState().discardDraft(),
    updatePendingNote: (note: string) =>
      useAnnotationAgentStore.getState().updatePendingNote(note),
  }
}
