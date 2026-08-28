import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { initMobiFile, type Mobi } from '@lingo-reader/mobi-parser'
import { Loader2 } from 'lucide-react'
import { PaneErrorBoundary } from '@/components/shared/PaneErrorBoundary'
import { AnnotationNoteDialog } from '@/components/reader/AnnotationNoteDialog'
import { ReaderContentShell } from '@/components/reader/ReaderContentShell'
import { ReaderFooterNav } from '@/components/reader/ReaderFooterNav'
import { ReaderToolbarShell } from '@/components/reader/ReaderToolbarShell'
import { SelectionToolbar } from '@/components/reader/SelectionToolbar'
import { useReaderBinary } from '@/hooks/useReaderBinary'
import { useReaderWheelNavigation } from '@/hooks/useReaderWheelNavigation'
import { useReadingMarks } from '@/hooks/useReadingMarks'
import type { ReaderUnit } from '@/lib/reader-navigation'
import { buildMobiChapterHtml } from '@/lib/mobi-chapter-html'
import { renderMobiMarkOverlays } from '@/lib/mobi-reading-marks'
import {
  flattenMobiToc,
  resolveMobiChapterNav,
  spineToChapterItems,
  type MobiChapterItem,
} from '@/lib/mobi-navigation'
import {
  copyTextToClipboard,
  getSelectionToolbarPosition,
  readPdfSelection,
  type PdfSelectionSnapshot,
} from '@/lib/pdf-selection'
import { buildReadingFileFingerprint } from '@/lib/reading-file-fingerprint'
import { reportAppError } from '@/lib/report-error'
import type { AppError } from '@shared/core/errors'
import type { ReadingMark } from '@shared/types/reading-mark'
import { isOk } from '@shared/core/result'
import { toast } from 'sonner'
import '@/styles/mobi-viewer.css'

interface MobiViewerProps {
  filePath: string
  theme: 'dark' | 'light'
}

export function MobiViewer({ filePath, theme }: MobiViewerProps) {
  const mobiRef = useRef<Mobi | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [chapters, setChapters] = useState<MobiChapterItem[]>([])
  const [currentChapterId, setCurrentChapterId] = useState<string>()
  const [chapterHtml, setChapterHtml] = useState('')
  const [ready, setReady] = useState(false)
  const [tocOpen, setTocOpen] = useState(false)
  const [marksOpen, setMarksOpen] = useState(false)
  const [selectionSnapshot, setSelectionSnapshot] = useState<PdfSelectionSnapshot | null>(null)
  const [selectionToolbarPos, setSelectionToolbarPos] = useState<{ x: number; y: number } | null>(
    null,
  )
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)

  const { data, isLoading, error } = useReaderBinary(filePath)
  const { marks, createMark, deleteMark } = useReadingMarks(filePath)
  const fileFingerprint = data
    ? buildReadingFileFingerprint(filePath, data.data.byteLength)
    : ''

  const chapterNav = useMemo(
    () => resolveMobiChapterNav(chapters, currentChapterId),
    [chapters, currentChapterId],
  )

  const outlineUnits: ReaderUnit[] = useMemo(
    () => chapters.map((chapter) => ({ label: chapter.label, href: chapter.id, level: 0 })),
    [chapters],
  )

  const loadChapter = useCallback((chapterId: string) => {
    const mobi = mobiRef.current
    if (!mobi) return

    const chapter = mobi.loadChapter(chapterId)
    if (!chapter) {
      toast.error('章节加载失败')
      return
    }

    setCurrentChapterId(chapterId)
    setChapterHtml(buildMobiChapterHtml(chapter))
  }, [])

  useEffect(() => {
    if (error && typeof error === 'object' && error !== null && 'code' in error) {
      reportAppError(error as AppError)
    }
  }, [error])

  useEffect(() => {
    if (!data) return

    let cancelled = false
    setReady(false)
    setChapters([])
    setChapterHtml('')
    setCurrentChapterId(undefined)
    mobiRef.current?.destroy()
    mobiRef.current = null

    void (async () => {
      try {
        const mobi = await initMobiFile(data.data)
        if (cancelled) {
          mobi.destroy()
          return
        }

        mobiRef.current = mobi
        const spine = mobi.getSpine()
        const toc = mobi.getToc()
        const fromToc = flattenMobiToc(toc, (href) => mobi.resolveHref(href)?.id)
        const nextChapters = fromToc.length > 0 ? fromToc : spineToChapterItems(spine)
        setChapters(nextChapters)

        if (nextChapters[0]) {
          loadChapter(nextChapters[0].id)
        }

        if (!cancelled) setReady(true)
      } catch (cause) {
        if (!cancelled) {
          reportAppError({
            code: 'FILE_READ_ERROR',
            message: cause instanceof Error ? cause.message : 'MOBI 加载失败',
          })
        }
      }
    })()

    return () => {
      cancelled = true
      mobiRef.current?.destroy()
      mobiRef.current = null
    }
  }, [data, filePath, loadChapter])

  useEffect(() => {
    const container = contentRef.current
    if (!container || !currentChapterId) return
    renderMobiMarkOverlays(container, marks, currentChapterId, theme)
  }, [chapterHtml, currentChapterId, marks, theme])

  const handleContentMouseUp = useCallback(() => {
    window.setTimeout(() => {
      const container = contentRef.current
      if (!container || !currentChapterId) return

      const snapshot = readPdfSelection(container, 0)
      if (!snapshot) {
        setSelectionSnapshot(null)
        setSelectionToolbarPos(null)
        return
      }

      setSelectionSnapshot(snapshot)
      setSelectionToolbarPos(getSelectionToolbarPosition(snapshot))
    }, 10)
  }, [currentChapterId])

  const addChapterBookmark = useCallback(async () => {
    if (!fileFingerprint || !currentChapterId) return
    const result = await createMark({
      filePath,
      fileFingerprint,
      kind: 'bookmark',
      anchor: { format: 'mobi', chapterId: currentChapterId },
      label: chapterNav.current?.label ?? '书签',
    })
    if (isOk(result)) toast.success('已添加书签')
  }, [chapterNav.current?.label, createMark, currentChapterId, fileFingerprint, filePath])

  const handleSaveAnnotation = useCallback(
    async (note: string) => {
      if (!selectionSnapshot || !fileFingerprint || !currentChapterId) return

      const result = await createMark({
        filePath,
        fileFingerprint,
        kind: note ? 'note' : 'highlight',
        anchor: {
          format: 'mobi',
          chapterId: currentChapterId,
          selectedText: selectionSnapshot.text,
          rects: selectionSnapshot.rects,
        },
        excerpt: selectionSnapshot.text,
        note: note || undefined,
      })

      if (isOk(result)) {
        toast.success(note ? '已保存批注' : '已添加高亮')
      }

      setSelectionSnapshot(null)
      setSelectionToolbarPos(null)
      window.getSelection()?.removeAllRanges()
    },
    [createMark, currentChapterId, fileFingerprint, filePath, selectionSnapshot],
  )

  const handleSelectMark = useCallback(
    (mark: ReadingMark) => {
      if (mark.anchor.format === 'mobi') {
        loadChapter(mark.anchor.chapterId)
      }
    },
    [loadChapter],
  )

  const handleDeleteMark = useCallback(
    async (mark: ReadingMark) => {
      await deleteMark(mark.id)
      toast.success('已删除')
    },
    [deleteMark],
  )

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0 })
  }, [currentChapterId, filePath])

  const currentTitle = chapterNav.current?.label ?? '—'

  const goPrevChapter = useCallback(() => {
    if (chapterNav.previous) loadChapter(chapterNav.previous.id)
  }, [chapterNav.previous, loadChapter])

  const goNextChapter = useCallback(() => {
    if (chapterNav.next) loadChapter(chapterNav.next.id)
  }, [chapterNav.next, loadChapter])

  useReaderWheelNavigation(scrollContainerRef, {
    enabled: ready && !isLoading,
    onPrev: goPrevChapter,
    onNext: goNextChapter,
  })

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ReaderToolbarShell
        ready={ready}
        tocDisabled={chapters.length === 0}
        onTocToggle={() => {
          setMarksOpen(false)
          setTocOpen((value) => !value)
        }}
        onMarksToggle={() => {
          setTocOpen(false)
          setMarksOpen((value) => !value)
        }}
        onAddBookmark={() => void addChapterBookmark()}
        currentTitle={currentTitle}
        trailing={
          (isLoading || !ready) ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : null
        }
      />

      <ReaderContentShell
        marksOpen={marksOpen}
        marks={marks}
        onSelectMark={handleSelectMark}
        onDeleteMark={(mark) => void handleDeleteMark(mark)}
        onCloseMarks={() => setMarksOpen(false)}
        tocOpen={tocOpen}
        units={outlineUnits}
        currentUnitId={currentChapterId}
        onCloseToc={() => setTocOpen(false)}
        onSelectUnit={(unit) => loadChapter(unit.href)}
      >
        <div ref={scrollContainerRef} className="h-full min-h-0 overflow-auto">
          <PaneErrorBoundary name="MOBI 阅读" filePath={filePath}>
            {isLoading ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                正在加载 MOBI…
              </div>
            ) : (
              <div
                ref={contentRef}
                className="mobi-chapter-content prose prose-sm max-w-none dark:prose-invert"
                data-theme={theme}
                dangerouslySetInnerHTML={{ __html: chapterHtml }}
                onMouseUp={handleContentMouseUp}
              />
            )}
          </PaneErrorBoundary>
        </div>
      </ReaderContentShell>

      <ReaderFooterNav
        ready={ready}
        currentTitle={currentTitle}
        previousTitle={chapterNav.previous?.label ?? '—'}
        nextTitle={chapterNav.next?.label ?? '—'}
        previousDisabled={!chapterNav.previous}
        nextDisabled={!chapterNav.next}
        onPrevious={goPrevChapter}
        onNext={goNextChapter}
      />

      {selectionToolbarPos && selectionSnapshot ? (
        <SelectionToolbar
          x={selectionToolbarPos.x}
          y={selectionToolbarPos.y}
          readOnly
          onCopy={() => {
            void copyTextToClipboard(selectionSnapshot.text).then((ok) => {
              if (ok) toast.success('已复制')
            })
            setSelectionToolbarPos(null)
          }}
          onAnnotate={() => {
            setNoteDialogOpen(true)
            setSelectionToolbarPos(null)
          }}
          onDismiss={() => {
            setSelectionToolbarPos(null)
            setSelectionSnapshot(null)
          }}
        />
      ) : null}

      <AnnotationNoteDialog
        open={noteDialogOpen}
        excerpt={selectionSnapshot?.text}
        onOpenChange={setNoteDialogOpen}
        onSave={(note) => void handleSaveAnnotation(note)}
      />
    </div>
  )
}
