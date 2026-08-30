import { getDocumentKind } from '@shared/types/document'
import { useActiveDocumentStore } from '@/stores/active-document-store'
import { useReaderNavigationStore } from '@/stores/reader-navigation-store'
import type { InkdownActiveDocument, InkdownReadingState } from './turn-context'

function baseName(filePath: string): string {
  const index = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return index === -1 ? filePath : filePath.slice(index + 1)
}

export function collectActiveDocument(): InkdownActiveDocument | null {
  const filePath = useActiveDocumentStore.getState().filePath?.trim()
  if (!filePath) return null
  return {
    path: filePath,
    kind: getDocumentKind(filePath),
    name: baseName(filePath),
  }
}

/** 阅读器进度：只有当阅读器确实停在同一个文件上时才给，避免报陈旧状态 */
export function collectReadingState(
  doc: InkdownActiveDocument | null,
): InkdownReadingState | undefined {
  if (!doc) return undefined
  const reader = useReaderNavigationStore.getState()
  if (!reader.ready || reader.filePath !== doc.path) return undefined

  const unitCount = reader.units.length
  const { flatIndex } = reader.nav
  const percent =
    unitCount > 0 && flatIndex >= 0
      ? Math.round(((flatIndex + 1) / unitCount) * 100)
      : undefined

  return {
    percent,
    current: reader.nav.current?.label,
    previous: reader.nav.previous?.label,
    next: reader.nav.next?.label,
    unitCount: unitCount > 0 ? unitCount : undefined,
  }
}
