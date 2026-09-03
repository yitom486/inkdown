import { useState } from 'react'
import type { ReactNode } from 'react'
import { ReadingMarkPanel } from '@/components/reader/ReadingMarkPanel'
import { ReaderUnitOutline } from '@/components/reader/ReaderUnitOutline'
import { FlashcardReviewDialog } from '@/components/reader/FlashcardReviewDialog'
import { AiQuizDialog } from '@/components/quiz/AiQuizDialog'
import { QuizHistoryDialog } from '@/components/quiz/QuizHistoryDialog'
import { buildAnkiCardsExport } from '@/lib/reader/export-anki-cards'
import type { Flashcard } from '@shared/types/flashcard'
import type { ReaderUnit } from '@/lib/reader/reader-navigation'
import {
  type ReadingNotesChapterRef,
  type ReadingNotesContentKind,
  type ReadingNotesScope,
} from '@/lib/reader/export-reading-notes'
import { passageExcerpt } from '@/lib/reader/reading-mark-passages'
import type { ReadingMark } from '@shared/types/reading-mark'
import { toast } from 'sonner'

interface ReaderContentShellProps {
  filePath?: string
  bookTitle?: string
  marksOpen: boolean
  marks: ReadingMark[]
  onSelectMark: (mark: ReadingMark) => void
  onDeleteMark: (mark: ReadingMark) => void
  onCloseMarks: () => void
  onExportNotes?: (contentKind: ReadingNotesContentKind, scope: ReadingNotesScope) => void
  onExportAnkiCards?: (scope: ReadingNotesScope) => void
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
  filePath,
  bookTitle,
  marksOpen,
  marks,
  onSelectMark,
  onDeleteMark,
  onCloseMarks,
  onExportNotes,
  onExportAnkiCards,
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
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewCards, setReviewCards] = useState<Flashcard[]>([])

  const [quizOpen, setQuizOpen] = useState(false)
  const [quizHistoryOpen, setQuizHistoryOpen] = useState(false)
  const [quizPassage, setQuizPassage] = useState('')
  const [quizChapterTitle, setQuizChapterTitle] = useState<string | undefined>()
  const [quizMarkId, setQuizMarkId] = useState<string | undefined>()

  const displayTitle =
    bookTitle ||
    (filePath ? filePath.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') : undefined) ||
    '当前书籍'

  const handleReviewFlashcards = (scope: ReadingNotesScope) => {
    const currentChapter = marksToc?.find((c) => c.key === marksCurrentChapterKey)
    const toc = marksToc ?? []
    const resolveChapter =
      marksResolveChapter ??
      ((mark: ReadingMark): ReadingNotesChapterRef => ({
        key: mark.id,
        matchKey: mark.id,
        label: '书本划线',
        level: 1,
      }))

    const exportResult = buildAnkiCardsExport({
      marks,
      bookTitle: displayTitle,
      scope,
      currentChapter,
      toc,
      resolveChapter,
    })

    if (!exportResult || exportResult.cards.length === 0) {
      toast.info('当前选定范围内暂无重点划线或批注卡片')
      return
    }

    setReviewCards(exportResult.cards)
    setReviewOpen(true)
  }

  const handleNavigateToMark = (markId: string) => {
    const mark = marks.find((m) => m.id === markId)
    if (mark) {
      onSelectMark(mark)
    }
  }

  const handleOpenQuiz = (mark?: ReadingMark, scope?: 'mark' | 'chapter' | 'book') => {
    if (scope === 'chapter') {
      let chapterLabel = '当前章节'
      const targetMarks = marks.filter((m) => {
        if (passageExcerpt(m).trim().length === 0) return false
        if (marksToc && marksResolveChapter && marksCurrentChapterKey) {
          const ch = marksResolveChapter(m, marksToc)
          return ch.key === marksCurrentChapterKey || ch.matchKey === marksCurrentChapterKey
        }
        return true
      })
      const combinedExcerpt = targetMarks.map((m) => passageExcerpt(m).trim()).join('\n\n')
      if (!combinedExcerpt) {
        toast.info('当前章节暂无重点划线')
        return
      }
      if (marksToc && marksResolveChapter && targetMarks[0]) {
        chapterLabel = marksResolveChapter(targetMarks[0], marksToc).label
      }
      setQuizPassage(combinedExcerpt)
      setQuizChapterTitle(`${chapterLabel} · 本章重点综合测`)
      setQuizMarkId(undefined)
      setQuizOpen(true)
      return
    }

    const targetMark = mark ?? marks.find((m) => passageExcerpt(m).trim().length > 0)
    const excerpt = targetMark ? passageExcerpt(targetMark).trim() : ''
    if (!targetMark || !excerpt) {
      toast.info('请先在书籍中划选重点，再让 AI 针对该段出题')
      return
    }

    let chapterLabel = '当前章节'
    if (marksToc && marksResolveChapter) {
      chapterLabel = marksResolveChapter(targetMark, marksToc).label
    }

    setQuizPassage(excerpt)
    setQuizChapterTitle(chapterLabel)
    setQuizMarkId(targetMark.id)
    setQuizOpen(true)
  }

  const handleRetryQuestion = (passage: string, chapterTitle?: string, markId?: string) => {
    setQuizPassage(passage)
    setQuizChapterTitle(chapterTitle)
    setQuizMarkId(markId)
    setQuizOpen(true)
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {marksOpen ? (
        <ReadingMarkPanel
          marks={marks}
          onSelect={onSelectMark}
          onDelete={onDeleteMark}
          onClose={onCloseMarks}
          onExportNotes={onExportNotes}
          onExportAnkiCards={onExportAnkiCards}
          onReviewFlashcards={handleReviewFlashcards}
          onOpenQuiz={handleOpenQuiz}
          onOpenQuizHistory={() => setQuizHistoryOpen(true)}
          onQuizMark={handleOpenQuiz}
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

      <FlashcardReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        cards={reviewCards}
        bookTitle={displayTitle}
        onNavigateToMark={handleNavigateToMark}
      />

      <AiQuizDialog
        open={quizOpen}
        onOpenChange={setQuizOpen}
        passage={quizPassage}
        bookTitle={displayTitle}
        filePath={filePath || ''}
        chapterTitle={quizChapterTitle}
        markId={quizMarkId}
        onNavigateToMark={handleNavigateToMark}
        onOpenHistory={() => setQuizHistoryOpen(true)}
      />

      <QuizHistoryDialog
        open={quizHistoryOpen}
        onOpenChange={setQuizHistoryOpen}
        bookTitle={displayTitle}
        filePath={filePath || ''}
        onNavigateToMark={handleNavigateToMark}
        onRetryQuestion={handleRetryQuestion}
      />
    </div>
  )
}
