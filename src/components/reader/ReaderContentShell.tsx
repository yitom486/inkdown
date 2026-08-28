import type { ReactNode } from 'react'
import { ReadingMarkPanel } from '@/components/reader/ReadingMarkPanel'
import { ReaderUnitOutline } from '@/components/reader/ReaderUnitOutline'
import type { ReaderUnit } from '@/lib/reader-navigation'
import type { ReadingMark } from '@shared/types/reading-mark'

interface ReaderContentShellProps {
  marksOpen: boolean
  marks: ReadingMark[]
  onSelectMark: (mark: ReadingMark) => void
  onDeleteMark: (mark: ReadingMark) => void
  onCloseMarks: () => void
  tocOpen: boolean
  units: ReaderUnit[]
  currentUnitId?: string
  onCloseToc: () => void
  onSelectUnit: (unit: ReaderUnit) => void
  children: ReactNode
}

export function ReaderContentShell({
  marksOpen,
  marks,
  onSelectMark,
  onDeleteMark,
  onCloseMarks,
  tocOpen,
  units,
  currentUnitId,
  onCloseToc,
  onSelectUnit,
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
        />
      ) : null}
      {tocOpen && units.length > 0 ? (
        <aside className="flex w-[min(28%,320px)] min-w-[180px] shrink-0 flex-col border-r border-border/60">
          <ReaderUnitOutline
            units={units}
            currentUnitId={currentUnitId}
            onToggle={onCloseToc}
            onSelectUnit={onSelectUnit}
          />
        </aside>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  )
}
