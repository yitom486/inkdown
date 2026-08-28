import { useCallback, useEffect, useRef, useState } from 'react'
import { Bookmark, ChevronLeft, ChevronRight, Loader2, Minus, Plus } from 'lucide-react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { TextLayer } from 'pdfjs-dist'
import { Button } from '@/components/ui/button'
import { PaneErrorBoundary } from '@/components/shared/PaneErrorBoundary'
import { AnnotationNoteDialog } from '@/components/reader/AnnotationNoteDialog'
import { ReadingMarkPanel } from '@/components/reader/ReadingMarkPanel'
import { SelectionToolbar } from '@/components/reader/SelectionToolbar'
import { useReaderBinary } from '@/hooks/useReaderBinary'
import { useReadingMarks } from '@/hooks/useReadingMarks'
import { pdfjsLib } from '@/lib/pdf-worker'
import { renderPdfMarkOverlays } from '@/lib/pdf-reading-marks'
import { isPdfRenderCancelled } from '@/lib/pdf-render'
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
import '@/styles/pdf-viewer.css'

interface PdfViewerProps {
  filePath: string
  theme: 'dark' | 'light'
}

export function PdfViewer({ filePath, theme }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pageWrapperRef = useRef<HTMLDivElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const marksLayerRef = useRef<HTMLDivElement>(null)
  const textLayerInstanceRef = useRef<TextLayer | null>(null)
  const pageRenderTaskRef = useRef<RenderTask | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null)
  const loadingTaskRef = useRef<ReturnType<typeof pdfjsLib.getDocument> | null>(null)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.2)
  const [rendering, setRendering] = useState(false)
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

  useEffect(() => {
    if (error && typeof error === 'object' && error !== null && 'code' in error) {
      reportAppError(error as AppError)
    }
  }, [error])

  useEffect(() => {
    if (!data) return

    let cancelled = false
    pdfDocRef.current = null
    loadingTaskRef.current = null
    setPageNum(1)
    setNumPages(0)

    void (async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({ data: data.data.slice() })
        loadingTaskRef.current = loadingTask
        const pdf = await loadingTask.promise
        if (cancelled) {
          void loadingTask.destroy()
          return
        }
        pdfDocRef.current = pdf
        setNumPages(pdf.numPages)
      } catch (cause) {
        if (!cancelled) {
          reportAppError({
            code: 'FILE_READ_ERROR',
            message: cause instanceof Error ? cause.message : 'PDF 加载失败',
          })
        }
      }
    })()

    return () => {
      cancelled = true
      void loadingTaskRef.current?.destroy()
      pdfDocRef.current = null
      loadingTaskRef.current = null
    }
  }, [data, filePath])

  useEffect(() => {
    const pdf = pdfDocRef.current
    const canvas = canvasRef.current
    const textLayerContainer = textLayerRef.current
    if (!pdf || !canvas || !textLayerContainer || pageNum < 1 || numPages === 0) {
      return
    }

    let cancelled = false
    setRendering(true)
    pageRenderTaskRef.current?.cancel()
    pageRenderTaskRef.current = null
    textLayerInstanceRef.current?.cancel()
    textLayerInstanceRef.current = null

    void (async () => {
      try {
        const page = await pdf.getPage(pageNum)
        if (cancelled) return

        const viewport = page.getViewport({ scale })
        canvas.width = viewport.width
        canvas.height = viewport.height
        const context = canvas.getContext('2d')
        if (!context) return

        const renderTask = page.render({ canvasContext: context, viewport, canvas })
        pageRenderTaskRef.current = renderTask
        await renderTask.promise
        if (cancelled) return

        textLayerContainer.replaceChildren()
        textLayerContainer.style.width = `${viewport.width}px`
        textLayerContainer.style.height = `${viewport.height}px`

        const textLayer = new TextLayer({
          textContentSource: page.streamTextContent(),
          container: textLayerContainer,
          viewport,
        })
        textLayerInstanceRef.current = textLayer
        await textLayer.render()
      } catch (cause) {
        if (!cancelled && !isPdfRenderCancelled(cause)) {
          reportAppError({
            code: 'FILE_READ_ERROR',
            message: cause instanceof Error ? cause.message : 'PDF 渲染失败',
          })
        }
      } finally {
        pageRenderTaskRef.current = null
        if (!cancelled) setRendering(false)
      }
    })()

    return () => {
      cancelled = true
      pageRenderTaskRef.current?.cancel()
      pageRenderTaskRef.current = null
      textLayerInstanceRef.current?.cancel()
      textLayerInstanceRef.current = null
    }
  }, [numPages, pageNum, scale])

  useEffect(() => {
    const marksLayer = marksLayerRef.current
    if (!marksLayer || pageNum < 1 || numPages === 0) return
    renderPdfMarkOverlays(marksLayer, marks, pageNum, theme)
  }, [marks, numPages, pageNum, theme])

  const fitWidth = useCallback(() => {
    const pdf = pdfDocRef.current
    const container = containerRef.current
    if (!pdf || !container || pageNum < 1) return

    void (async () => {
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1 })
      const nextScale = Math.max(0.5, (container.clientWidth - 32) / viewport.width)
      setScale(Number(nextScale.toFixed(2)))
    })()
  }, [pageNum])

  useEffect(() => {
    fitWidth()
  }, [fitWidth, filePath, numPages])

  useEffect(() => {
    setSelectionSnapshot(null)
    setSelectionToolbarPos(null)
  }, [pageNum, filePath])

  const handlePageMouseUp = useCallback(() => {
    window.setTimeout(() => {
      const pageElement = pageWrapperRef.current
      if (!pageElement) return

      const snapshot = readPdfSelection(pageElement, pageNum)
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
  }, [pageNum])

  const goPrev = () => setPageNum((value) => Math.max(1, value - 1))
  const goNext = () => setPageNum((value) => Math.min(numPages, value + 1))

  const addPageBookmark = useCallback(async () => {
    if (!fileFingerprint || numPages === 0) return
    const result = await createMark({
      filePath,
      fileFingerprint,
      kind: 'bookmark',
      anchor: { format: 'pdf', page: pageNum },
      label: `第 ${pageNum} 页`,
    })
    if (isOk(result)) {
      toast.success('已添加书签')
    }
  }, [createMark, fileFingerprint, filePath, numPages, pageNum])

  const handleSaveAnnotation = useCallback(
    async (note: string) => {
      if (!selectionSnapshot || !fileFingerprint) return

      const result = await createMark({
        filePath,
        fileFingerprint,
        kind: note ? 'note' : 'highlight',
        anchor: {
          format: 'pdf',
          page: selectionSnapshot.page,
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
    [createMark, fileFingerprint, filePath, selectionSnapshot],
  )

  const handleSelectMark = useCallback((mark: ReadingMark) => {
    if (mark.anchor.format === 'pdf') {
      setPageNum(mark.anchor.page)
    }
  }, [])

  const handleDeleteMark = useCallback(
    async (mark: ReadingMark) => {
      await deleteMark(mark.id)
      toast.success('已删除')
    },
    [deleteMark],
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-border/60 px-3 py-2">
        <Button variant="ghost" size="icon-sm" disabled={pageNum <= 1} onClick={goPrev}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-24 text-center text-sm text-muted-foreground">
          {numPages > 0 ? `${pageNum} / ${numPages}` : '—'}
        </span>
        <Button variant="ghost" size="icon-sm" disabled={pageNum >= numPages} onClick={goNext}>
          <ChevronRight className="size-4" />
        </Button>
        <div className="mx-2 h-4 w-px bg-border/60" />
        <Button variant="ghost" size="icon-sm" onClick={() => setScale((value) => Math.max(0.5, value - 0.1))}>
          <Minus className="size-4" />
        </Button>
        <span className="w-12 text-center text-xs text-muted-foreground">{Math.round(scale * 100)}%</span>
        <Button variant="ghost" size="icon-sm" onClick={() => setScale((value) => Math.min(3, value + 0.1))}>
          <Plus className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" className="ml-1 h-7 text-xs" onClick={fitWidth}>
          适合宽度
        </Button>
        <div className="mx-2 h-4 w-px bg-border/60" />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          disabled={numPages === 0}
          onClick={() => setMarksOpen((value) => !value)}
        >
          <Bookmark className="size-3.5" />
          书签
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          disabled={numPages === 0}
          onClick={() => void addPageBookmark()}
        >
          添加书签
        </Button>
        {(isLoading || rendering) && <Loader2 className="ml-auto size-4 animate-spin text-muted-foreground" />}
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
        <div
          ref={containerRef}
          className={`min-h-0 flex-1 overflow-auto ${theme === 'dark' ? 'bg-zinc-900' : 'bg-zinc-100'}`}
        >
          <PaneErrorBoundary name="PDF 阅读" filePath={filePath}>
            <div className="flex min-h-full justify-center p-4">
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  正在加载 PDF…
                </div>
              ) : (
                <div
                  ref={pageWrapperRef}
                  className="pdf-page-wrapper shadow-md"
                  onMouseUp={handlePageMouseUp}
                >
                  <canvas ref={canvasRef} />
                  <div ref={textLayerRef} className="textLayer" aria-hidden="false" />
                  <div ref={marksLayerRef} className="pdf-marks-layer" />
                </div>
              )}
            </div>
          </PaneErrorBoundary>
        </div>
      </div>

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
