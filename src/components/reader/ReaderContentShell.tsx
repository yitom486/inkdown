import type { ReactNode } from 'react'
import { ReadingMarkPanel } from '@/components/reader/ReadingMarkPanel'
import { ReaderUnitOutline } from '@/components/reader/ReaderUnitOutline'
import type { ReaderUnit } from '@/lib/reader/reader-navigation'
import type {
  ReadingNotesChapterRef,
  ReadingNotesContentKind,
  ReadingNotesScope,
} from '@/lib/reader/export-reading-notes'
import type { ReadingMark } from '@shared/types/reading-mark'

interface ReaderContentShellProps {
  marksOpen: boolean
  marks: ReadingMark[]
  onSelectMark: (mark: ReadingMark) => void
  onDeleteMark: (mark: ReadingMark) => void
  onCloseMarks: () => void
  onExportNotes?: (contentKind: ReadingNotesContentKind, scope: ReadingNotesScope) => void
  marksToc?: ReadingNotesChapterRef[]
  marksCurrentChapterKey?: string
  marksResolveChapter?: (
    mark: ReadingMark,
    toc: ReadingNotesChapterRef[],
  ) => ReadingNotesChapterRef
  tocOpen: boolean
  units: ReaderUnit[]
  currentUnitId?: string
  onCloseToc: () => void
  onSelectUnit: (unit: ReaderUnit) => void
  onEditToc?: () => void
  outlineNotice?: string
  tocAside?: ReactNode
  children: ReactNode
}

export function ReaderContentShell({
  marksOpen,
  marks,
  onSelectMark,
  onDeleteMark,
  onCloseMarks,
  onExportNotes,
  marksToc,
  marksCurrentChapterKey,
  marksResolveChapter,
  tocOpen,
  units,
  currentUnitId,
  onCloseToc,
  onSelectUnit,
  onEditToc,
  outlineNotice,
  tocAside,
  children,
}: ReaderContentShellProps) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {marksOpen ? (
        <ReadingMarkPanel
          marks={marks}
          onSelect={onSelectMark}
          onDelete={onDeleteMark}
          onClose={onCloseMarks}
          onExportNotes={onExportNotes}
          marksToc={marksToc}
          currentChapterKey={marksCurrentChapterKey}
          resolveChapter={marksResolveChapter}
        />
      ) : null}
      {tocOpen && tocAside ? tocAside : null}
      {tocOpen && !tocAside && units.length > 0 ? (
        <aside className="flex w-[min(28%,320px)] min-w-[180px] shrink-0 flex-col border-r border-border/60">
          <ReaderUnitOutline
            units={units}
            currentUnitId={currentUnitId}
            onToggle={onCloseToc}
            onSelectUnit={onSelectUnit}
            onEditToc={onEditToc}
            outlineNotice={outlineNotice}
          />
        </aside>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  )
}
