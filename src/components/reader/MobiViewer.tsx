import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { initMobiFile, type Mobi } from '@lingo-reader/mobi-parser'
import { Bookmark, ChevronLeft, ChevronRight, List, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PaneErrorBoundary } from '@/components/shared/PaneErrorBoundary'
import { AnnotationNoteDialog } from '@/components/reader/AnnotationNoteDialog'
import { EpubChapterOutline } from '@/components/reader/EpubChapterOutline'
import { ReadingMarkPanel } from '@/components/reader/ReadingMarkPanel'
import { SelectionToolbar } from '@/components/reader/SelectionToolbar'
import { useReaderBinary } from '@/hooks/useReaderBinary'
import { useReadingMarks } from '@/hooks/useReadingMarks'
import type { EpubChapter } from '@/lib/epub-navigation'
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

  const outlineChapters: EpubChapter[] = useMemo(
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
      setSelectionToolbarPos({
        x: snapshot.rect.left + snapshot.rect.width / 2,
        y: snapshot.rect.top,
      })
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

  const currentTitle = chapterNav.current?.label ?? '—'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-border/60 px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          disabled={!ready || chapters.length === 0}
          onClick={() => {
            setMarksOpen(false)
            setTocOpen((value) => !value)
          }}
        >
          <List className="size-3.5" />
          目录
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          disabled={!ready}
          onClick={() => {
            setTocOpen(false)
            setMarksOpen((value) => !value)
          }}
        >
          <Bookmark className="size-3.5" />
          书签
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          disabled={!ready}
          onClick={() => void addChapterBookmark()}
        >
          添加书签
        </Button>
        <span className="ml-2 min-w-0 truncate text-xs text-muted-foreground">{currentTitle}</span>
        {(isLoading || !ready) && (
          <Loader2 className="ml-auto size-4 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {marksOpen ? (
          <ReadingMarkPanel
            marks={marks}
            onSelect={handleSelectMark}
            onDelete={(mark) => void handleDeleteMark(mark)}
            onClose={() => setMarksOpen(false)}
          />
        ) : null}
        {tocOpen && chapters.length > 0 ? (
          <aside className="flex w-[min(28%,320px)] min-w-[180px] shrink-0 flex-col border-r border-border/60">
            <EpubChapterOutline
              chapters={outlineChapters}
              currentHref={currentChapterId}
              onToggle={() => setTocOpen(false)}
              onSelectChapter={(chapter) => loadChapter(chapter.href)}
            />
          </aside>
        ) : null}
        <div className="min-h-0 min-w-0 flex-1 overflow-auto">
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
      </div>

      <footer className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-border/60 bg-sidebar px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-auto min-h-9 justify-start gap-1 px-2 py-1.5 text-left"
          disabled={!ready || !chapterNav.previous}
          onClick={() => chapterNav.previous && loadChapter(chapterNav.previous.id)}
        >
          <ChevronLeft className="size-4 shrink-0" />
          <span className="min-w-0">
            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
              上一章
            </span>
            <span className="block truncate text-xs">{chapterNav.previous?.label ?? '—'}</span>
          </span>
        </Button>
        <div className="px-2 text-center">
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
            当前章节
          </span>
          <span className="block max-w-40 truncate text-xs font-medium">{currentTitle}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto min-h-9 justify-end gap-1 px-2 py-1.5 text-right"
          disabled={!ready || !chapterNav.next}
          onClick={() => chapterNav.next && loadChapter(chapterNav.next.id)}
        >
          <span className="min-w-0">
            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
              下一章
            </span>
            <span className="block truncate text-xs">{chapterNav.next?.label ?? '—'}</span>
          </span>
          <ChevronRight className="size-4 shrink-0" />
        </Button>
      </footer>

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
