import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { TextLayer } from 'pdfjs-dist'
import {
  createPdfPageViewport,
  isPdfRenderCancelled,
} from '@/lib/pdf-render'
import { renderPdfMarkOverlays } from '@/lib/pdf-reading-marks'
import { setupPdfTextLayerSelection } from '@/lib/pdf-text-layer-selection'
import { reportAppError } from '@/lib/report-error'
import type { ReadingMark } from '@shared/types/reading-mark'

interface PdfPageViewProps {
  pdf: PDFDocumentProxy
  pageNumber: number
  scale: number
  theme: 'dark' | 'light'
  marks: ReadingMark[]
  onMouseUp?: (pageNumber: number, pageElement: HTMLElement) => void
}

export function PdfPageView({
  pdf,
  pageNumber,
  scale,
  theme,
  marks,
  onMouseUp,
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

        const { cssViewport, renderViewport } = createPdfPageViewport(page, scale)
        canvas.width = Math.floor(renderViewport.width)
        canvas.height = Math.floor(renderViewport.height)
        canvas.style.width = `${cssViewport.width}px`
        canvas.style.height = `${cssViewport.height}px`

        const context = canvas.getContext('2d')
        if (!context) return

        const renderTask = page.render({
          canvasContext: context,
          viewport: renderViewport,
          canvas,
        })
        renderTaskRef.current = renderTask
        await renderTask.promise
        if (cancelled) return

        textLayerContainer.replaceChildren()
        textLayerContainer.style.width = `${cssViewport.width}px`
        textLayerContainer.style.height = `${cssViewport.height}px`

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
      onMouseUp={() => {
        const pageElement = wrapperRef.current
        if (pageElement) onMouseUp?.(pageNumber, pageElement)
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
