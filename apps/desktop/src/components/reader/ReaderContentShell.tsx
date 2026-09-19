import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Bookmark, ChevronLeft } from 'lucide-react'
import { ReadingMarkPanel } from '@/components/reader/ReadingMarkPanel'
import { ReaderUnitOutline } from '@/components/reader/ReaderUnitOutline'
import { MarginaliaBar } from '@/components/reader/MarginaliaBar'
import { FlashcardReviewDialog } from '@/components/reader/FlashcardReviewDialog'
import { AiQuizDialog } from '@/components/quiz/AiQuizDialog'
import { QuizHistoryDialog } from '@/components/quiz/QuizHistoryDialog'
import { buildAnkiCardsExport } from '@/lib/reader/marks/export-anki-cards'
import { useReaderHudUiStore } from '@/stores/acp/reader-hud-store'
import { useAcpUiStore } from '@/stores/acp-ui-store'
import { preserveScrollAnchor } from '@/lib/reader/scroll-anchor'
import type { Flashcard } from '@inkdown/annotations'
import type { ReaderUnit } from '@inkdown/reader-core'
import {
  findCurrentChapterRef,
  type ReadingNotesChapterRef,
  type ReadingNotesContentKind,
  type ReadingNotesScope,
} from '@inkdown/reader-core'
import { passageExcerpt } from '@inkdown/reader-core'
import type { ReadingMark } from '@inkdown/contracts'
import type { DiagramVisualStep } from '@/components/agent/tools/DiagramViewerCard'
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
  /** 卡片悬停时透出原文 excerpt（EPUB 用 CSS 高亮 API 照亮正文，PDF 画布暂不支持） */
  onHoverExcerpt?: (excerpt: string | undefined) => void
  /** 正文书级阅读进度 0~1：卡片轨等比跟随滚动；缺省不同滚 */
  readingFraction?: number
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
  onHoverExcerpt,
  readingFraction,
}: ReaderContentShellProps) {
  // 知识卡轨与伴读联动状态
  const isCardRailOpen = useReaderHudUiStore((s) => s.isCardRailOpen)
  const setIsCardRailOpen = useReaderHudUiStore((s) => s.setIsCardRailOpen)
  const hudDisplayMode = useAcpUiStore((s) => s.hudDisplayMode)
  const panelOpen = useAcpUiStore((s) => s.panelOpen)
  const zenMode = useReaderHudUiStore((s) => s.zenMode)
  const setSelectedDiagram = useReaderHudUiStore((s) => s.setSelectedDiagram)
  const openPanelAndFocusComposer = useAcpUiStore((s) => s.openPanelAndFocusComposer)

  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({})

  const handleToggleCardCollapse = (id: string) => {
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleToggleAllCollapse = (collapse: boolean) => {
    const next: Record<string, boolean> = {}
    for (const m of marks) {
      next[m.id] = collapse
    }
    setCollapsedMap(next)
  }

  const enhancedMarks = marks.map((m) => ({
    ...m,
    collapsed: collapsedMap[m.id] ?? m.collapsed,
  }))

  // 目录键序：卡片按文档位置排序用（纵序对齐正文）
  const chapterOrder = useMemo(() => marksToc?.map((t) => t.key) ?? [], [marksToc])

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
    const toc = marksToc ?? []
    const currentChapter = findCurrentChapterRef(toc, marksCurrentChapterKey)
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
      currentChapter: scope === 'chapter' ? currentChapter : null,
      toc,
      resolveChapter,
    })

    if (!exportResult || exportResult.cards.length === 0) {
      toast.info(
        scope === 'chapter'
          ? '当前章节暂无重点划线或批注卡片'
          : '当前选定范围内暂无重点划线或批注卡片',
      )
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

      {isCardRailOpen ? (
        <MarginaliaBar
          marks={enhancedMarks}
          onMarkClick={onSelectMark}
          onHoverAnchor={onHoverExcerpt}
          chapterOfMark={(m) => {
            // 优先读写入时固化的章节归属；老数据缺字段时回落运行时解析
            if (m.chapter) return { key: m.chapter.key, label: m.chapter.label }
            if (!(marksToc && marksResolveChapter)) return null
            try {
              const ref = marksResolveChapter(m, marksToc)
              return { key: ref.matchKey, label: ref.label }
            } catch {
              return null
            }
          }}
          currentChapterKey={marksCurrentChapterKey}
          chapterOrder={chapterOrder}
          readingFraction={readingFraction}
          onDeleteMark={(id) => {
            const m = marks.find((item) => item.id === id)
            if (m) onDeleteMark(m)
          }}
          onOpenDiagram={(diagramId) => {
            const m = marks.find((item) => item.diagramId === diagramId)
            const fallbackSteps: DiagramVisualStep[] =
              m?.keyPoints && m.keyPoints.length > 0
                ? m.keyPoints.map((kp, idx) => ({
                    from: `阶段 ${idx + 1}`,
                    to: `推演 ${idx + 2}`,
                    action: kp,
                    desc: kp,
                  }))
                : [
                    {
                      from: '概念源起',
                      to: '核心脉络',
                      action: '提炼核心概念',
                      desc: m?.excerpt ?? '概念正文解构',
                    },
                    {
                      from: '核心脉络',
                      to: '认知图景',
                      action: '多维穿透解析',
                      desc: m?.aiSummary ?? '时序流转分析',
                    },
                  ]

            setSelectedDiagram({
              diagramId,
              diagramType: 'sequence',
              title: m?.title ?? '时序流转交互图谱',
              mermaidCode: m?.note?.includes('mermaid')
                ? m.note.replace(/```mermaid\n?|\n?```/g, '').trim()
                : 'sequenceDiagram\n  autonumber\n  Reader->>AI: 提出概念追问\n  AI-->>Reader: 返回分步交互图解',
              summary: m?.aiSummary ?? m?.excerpt,
              visualSteps: fallbackSteps,
            })
          }}
          onToggleCardCollapse={handleToggleCardCollapse}
          onToggleAllCollapse={handleToggleAllCollapse}
          onCloseRail={() => preserveScrollAnchor(() => setIsCardRailOpen(false))}
          onGenerateAiCard={() => openPanelAndFocusComposer()}
          className="h-full"
        />
      ) : null}

      {/* 知识卡轨折叠收起时，右边沿悬浮微晶书签浮纽 */}
      {!zenMode && !isCardRailOpen && marks.length > 0 && (
        <button
          type="button"
          onClick={() => preserveScrollAnchor(() => setIsCardRailOpen(true))}
          className={`fixed top-20 z-40 px-3 py-1.5 rounded-full bg-background/90 backdrop-blur-md border border-border shadow-lg hover:border-primary text-foreground hover:text-primary transition-all cursor-pointer flex items-center gap-1.5 text-xs font-serif group animate-in fade-in ${
            panelOpen && hudDisplayMode === 'docked' ? 'right-[400px]' : 'right-4'
          }`}
          title="展开知识卡片栏"
        >
          <Bookmark className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
          <span>知识卡片 ({marks.length})</span>
          <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
      )}

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
