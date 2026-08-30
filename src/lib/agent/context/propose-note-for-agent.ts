import { toast } from 'sonner'
import { getReaderMarksProvider } from '@/lib/agent/context/reader-marks-registry'
import { readSelectionText } from '@/lib/agent/context/reader-selection-registry'
import {
  annotationFileKey,
  useAnnotationAgentStore,
} from '@/stores/annotation-agent-store'

export async function proposeNoteForAgent(note: string): Promise<{
  proposed: true
  note: string
  excerpt: string
  message: string
}> {
  const provider = getReaderMarksProvider()
  if (!provider) {
    throw new Error('当前阅读器未就绪，无法提出批注')
  }

  const trimmed = note.trim()
  const excerpt = readSelectionText(provider.filePath)?.trim() ?? ''
  const fileKey = annotationFileKey('', provider.filePath)
  const store = useAnnotationAgentStore.getState()
  store.ensureFile(fileKey)
  store.setPendingDraft({
    fileKey,
    excerpt,
    note: trimmed,
    source: 'ai',
    lastIntentLabel: 'Agent 提议',
  })
  store.setPhase('ready')
  store.setExternalProposeOpen(true)
  toast.message('Agent 已提出批注草稿，请确认后保存')

  return {
    proposed: true,
    note: trimmed,
    excerpt,
    message:
      '已生成批注草稿并打开确认界面；用户点击「采用」后才会写入书签库，请勿假定已保存。',
  }
}

export async function createNoteForAgent(note: string): Promise<{
  proposed: true
  note: string
  excerpt: string
  message: string
}> {
  return proposeNoteForAgent(note)
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
