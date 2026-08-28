import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Minus, Plus } from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { Button } from '@/components/ui/button'
import { PaneErrorBoundary } from '@/components/shared/PaneErrorBoundary'
import { useReaderBinary } from '@/hooks/useReaderBinary'
import { pdfjsLib } from '@/lib/pdf-worker'
import { reportAppError } from '@/lib/report-error'
import type { AppError } from '@shared/errors'

interface PdfViewerProps {
  filePath: string
  theme: 'dark' | 'light'
}

export function PdfViewer({ filePath, theme }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null)
  const loadingTaskRef = useRef<ReturnType<typeof pdfjsLib.getDocument> | null>(null)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.2)
  const [rendering, setRendering] = useState(false)

  const { data, isLoading, error } = useReaderBinary(filePath)

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
    if (!pdf || !canvas || pageNum < 1 || numPages === 0) return

    let cancelled = false
    setRendering(true)

    void (async () => {
      try {
        const page = await pdf.getPage(pageNum)
        if (cancelled) return

        const viewport = page.getViewport({ scale })
        canvas.width = viewport.width
        canvas.height = viewport.height
        const context = canvas.getContext('2d')
        if (!context) return

        await page.render({ canvasContext: context, viewport, canvas }).promise
      } catch (cause) {
        if (!cancelled) {
          reportAppError({
            code: 'FILE_READ_ERROR',
            message: cause instanceof Error ? cause.message : 'PDF 渲染失败',
          })
        }
      } finally {
        if (!cancelled) setRendering(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [numPages, pageNum, scale])

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

  const goPrev = () => setPageNum((value) => Math.max(1, value - 1))
  const goNext = () => setPageNum((value) => Math.min(numPages, value + 1))

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
        {(isLoading || rendering) && <Loader2 className="ml-auto size-4 animate-spin text-muted-foreground" />}
      </div>

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
              <canvas ref={canvasRef} className="shadow-md" />
            )}
          </div>
        </PaneErrorBoundary>
      </div>
    </div>
  )
}
