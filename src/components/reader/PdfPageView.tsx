import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { TextLayer } from 'pdfjs-dist'
import {
  createPdfPageViewport,
  isPdfRenderCancelled,
} from '@/lib/reader/pdf-render'
import { renderPdfMarkOverlays } from '@/lib/reader/pdf-reading-marks'
import { setupPdfTextLayerSelection } from '@/lib/reader/pdf-text-layer-selection'
import { reportAppError } from '@/lib/workspace/report-error'
import type { ReadingMark } from '@shared/types/reading-mark'

interface PdfPageViewProps {
  pdf: PDFDocumentProxy
  pageNumber: number
  scale: number
  theme: 'dark' | 'light'
  marks: ReadingMark[]
  onMouseUp?: (pageNumber: number, pageElement: HTMLElement, point: { clientX: number; clientY: number }) => void
  onPointerOrigin?: (x: number, y: number) => void
}

export function PdfPageView({
  pdf,
  pageNumber,
  scale,
  theme,
  marks,
  onMouseUp,
  onPointerOrigin,
}: PdfPageViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const marksLayerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const renderTaskRef = useRef<RenderTask | null>(null)
  const textLayerInstanceRef = useRef<TextLayer | null>(null)
  const [rendering, setRendering] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    const textLayerContainer = textLayerRef.current
    if (!canvas || !textLayerContainer) return

    let cancelled = false
    let teardownSelection: (() => void) | undefined
    setRendering(true)
    renderTaskRef.current?.cancel()
    renderTaskRef.current = null
    textLayerInstanceRef.current?.cancel()
    textLayerInstanceRef.current = null

    void (async () => {
      try {
        const page = await pdf.getPage(pageNumber)
        if (cancelled) return

        const { cssViewport, cssWidth, cssHeight, canvasWidth, canvasHeight, transform } =
          createPdfPageViewport(page, scale)
        canvas.width = canvasWidth
        canvas.height = canvasHeight
        canvas.style.width = `${cssWidth}px`
        canvas.style.height = `${cssHeight}px`

        const context = canvas.getContext('2d', { alpha: false })
        if (!context) return
        context.setTransform(1, 0, 0, 1, 0, 0)

        const renderTask = page.render({
          canvasContext: context,
          viewport: cssViewport,
          transform,
          canvas,
          background: '#ffffff',
        })
        renderTaskRef.current = renderTask
        await renderTask.promise
        if (cancelled) return

        textLayerContainer.replaceChildren()
        textLayerContainer.style.width = `${cssWidth}px`
        textLayerContainer.style.height = `${cssHeight}px`

        const textLayer = new TextLayer({
          textContentSource: page.streamTextContent({
            includeMarkedContent: true,
            disableNormalization: true,
          }),
          container: textLayerContainer,
          viewport: cssViewport,
        })
        textLayerInstanceRef.current = textLayer
        await textLayer.render()
        teardownSelection = setupPdfTextLayerSelection(textLayerContainer)
      } catch (cause) {
        if (!cancelled && !isPdfRenderCancelled(cause)) {
          reportAppError({
            code: 'FILE_READ_ERROR',
            message: cause instanceof Error ? cause.message : 'PDF 渲染失败',
          })
        }
      } finally {
        renderTaskRef.current = null
        if (!cancelled) setRendering(false)
      }
    })()

    return () => {
      cancelled = true
      teardownSelection?.()
      renderTaskRef.current?.cancel()
      renderTaskRef.current = null
      textLayerInstanceRef.current?.cancel()
      textLayerInstanceRef.current = null
    }
  }, [pageNumber, pdf, scale])

  useEffect(() => {
    const marksLayer = marksLayerRef.current
    if (!marksLayer) return
    renderPdfMarkOverlays(marksLayer, marks, pageNumber, theme)
  }, [marks, pageNumber, theme])

  return (
    <div
      ref={wrapperRef}
      className="pdf-page-wrapper relative shadow-md"
      data-page={pageNumber}
      onMouseDown={(event) => onPointerOrigin?.(event.clientX, event.clientY)}
      onMouseUp={(event) => {
        const pageElement = wrapperRef.current
        if (pageElement) onMouseUp?.(pageNumber, pageElement, event)
      }}
    >
      {rendering ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-sm bg-white/90 dark:bg-zinc-800/90">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : null}
      <canvas ref={canvasRef} />
      <div ref={textLayerRef} className="textLayer" aria-hidden="false" />
      <div ref={marksLayerRef} className="pdf-marks-layer" />
    </div>
  )
}
