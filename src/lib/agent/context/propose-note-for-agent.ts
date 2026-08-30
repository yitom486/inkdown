import { toast } from 'sonner'
import { getReaderMarksProvider } from '@/lib/agent/context/reader-marks-registry'
import { readSelectionText } from '@/lib/agent/context/reader-selection-registry'
import {
  annotationFileKey,
  useAnnotationAgentStore,
} from '@/stores/annotation-agent-store'

export interface ProposeNoteOptions {
  /** 是否弹出全局确认框；批注小窗内已有编辑区时传 false */
  openConfirmUi?: boolean
  excerpt?: string
  filePath?: string
  fileFingerprint?: string
}

export async function proposeNoteForAgent(
  note: string,
  options: ProposeNoteOptions = {},
): Promise<{
  proposed: true
  note: string
  excerpt: string
  message: string
}> {
  const provider = getReaderMarksProvider()
  const filePath = options.filePath ?? provider?.filePath
  if (!filePath && !provider) {
    throw new Error('当前阅读器未就绪，无法提出批注')
  }

  const trimmed = note.trim()
  const excerpt =
    options.excerpt?.trim() ||
    (provider ? readSelectionText(provider.filePath)?.trim() ?? '' : '')
  const fileKey = annotationFileKey(options.fileFingerprint ?? '', filePath ?? provider!.filePath)
  const store = useAnnotationAgentStore.getState()
  store.ensureFile(fileKey)
  store.setPendingDraft({
    fileKey,
    excerpt,
    note: trimmed,
    source: 'ai',
    lastIntentLabel: '批注草稿',
  })
  store.setPhase('editing')
  if (options.openConfirmUi !== false) {
    store.setExternalProposeOpen(true)
    toast.message('已提出批注草稿，可编辑后采用')
  }

  return {
    proposed: true,
    note: trimmed,
    excerpt,
    message:
      '已生成可编辑批注草稿；用户确认「采用」后才会写入书签库，请勿假定已保存。',
  }
}

export async function createNoteForAgent(note: string): Promise<{
  proposed: true
  note: string
  excerpt: string
  message: string
}> {
  return proposeNoteForAgent(note, { openConfirmUi: true })
}

export async function adoptProposedNote(note: string): Promise<void> {
  const provider = getReaderMarksProvider()
  if (!provider) {
    throw new Error('当前阅读器未就绪，无法保存批注')
  }
  await provider.createNoteFromSelection(note.trim())
  const store = useAnnotationAgentStore.getState()
  store.discardDraft()
  store.setExternalProposeOpen(false)
}

export function dismissProposedNote(): void {
  const store = useAnnotationAgentStore.getState()
  store.discardDraft()
  store.setExternalProposeOpen(false)
}
