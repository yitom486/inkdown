import { toast } from 'sonner'
import type { ProposedMark, ProposedMarkSource } from '@shared/types/mark-proposal'
import { toProposedMark } from '@shared/types/mark-proposal'
import { getReaderMarksProvider } from '@/lib/agent/context/reader-marks-registry'
import { readSelectionText } from '@/lib/agent/context/reader-selection-registry'
import {
  annotationFileKey,
  useAnnotationAgentStore,
} from '@/stores/annotation-agent-store'

export interface ProposeMarkOptions {
  excerpt?: string
  filePath?: string
  fileFingerprint?: string
  locationHint?: string
  source?: ProposedMarkSource
}

export interface ProposeMarkResult {
  proposed: true
  note: string
  excerpt: string
  message: string
  mark: ProposedMark
}

export async function proposeMarkForAgent(
  note: string,
  options: ProposeMarkOptions = {},
): Promise<ProposeMarkResult> {
  const provider = getReaderMarksProvider()
  const filePath = options.filePath ?? provider?.filePath
  if (!filePath && !provider) {
    throw new Error('当前阅读器未就绪，无法提出标记')
  }

  const trimmed = note.trim()
  const excerpt =
    options.excerpt?.trim() ||
    (provider ? readSelectionText(provider.filePath)?.trim() ?? '' : '')
  const fileKey = annotationFileKey(options.fileFingerprint ?? '', filePath ?? provider!.filePath)
  const mark = toProposedMark({
    excerpt,
    note: trimmed,
    locationHint: options.locationHint,
    source: options.source ?? 'agent',
  })

  const store = useAnnotationAgentStore.getState()
  store.ensureFile(fileKey)
  store.setPendingDraft({
    fileKey,
    excerpt,
    note: trimmed,
    source: 'ai',
    lastIntentLabel: mark.kind === 'highlight' ? '高亮提议' : '批注草稿',
  })
  store.setPhase('editing')
  store.setProposeHost(options.source === 'annotation' ? 'annotation' : 'main-agent')
  toast.message(
    mark.kind === 'highlight' ? '已提出高亮，可在会话内确认' : '已提出批注草稿，可在会话内确认',
  )

  return {
    proposed: true,
    note: trimmed,
    excerpt,
    message:
      '已生成可编辑标记提议；用户确认「采用」后才会写入书签库，请勿假定已保存。',
    mark,
  }
}

export async function adoptProposedMark(note: string): Promise<void> {
  const provider = getReaderMarksProvider()
  if (!provider) {
    throw new Error('当前阅读器未就绪，无法保存标记')
  }
  await provider.createNoteFromSelection(note.trim())
  const store = useAnnotationAgentStore.getState()
  store.discardDraft()
  store.setExternalProposeOpen(false)
}

export function dismissProposedMark(): void {
  const store = useAnnotationAgentStore.getState()
  store.discardDraft()
  store.setExternalProposeOpen(false)
}
