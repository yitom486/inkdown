import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { PDFDocumentProxy, PageViewport, RenderTask } from 'pdfjs-dist'
import {
  createPdfPageViewport,
  isPdfRenderCancelled,
} from '@/lib/reader/pdf-render'
import { renderPdfMarkOverlays } from '@/lib/reader/pdf-reading-marks'
import {
  loadPdfTextLayerBuilder,
  type PdfTextLayerBuilderInstance,
} from '@/lib/reader/pdf-text-layer-builder'
import {
  PdfTextLayerMappingSink,
  registerPdfPageTextGeometry,
  type PdfSelectionSnapshot,
} from '@/lib/reader/pdf-selection'
import { reportAppError } from '@/lib/workspace/report-error'
import type { ReadingMark } from '@shared/types/reading-mark'

interface PdfPageViewProps {
  pdf: PDFDocumentProxy
  pageNumber: number
  scale: number
  theme: 'dark' | 'light'
  marks: ReadingMark[]
  transientSelection?: PdfSelectionSnapshot | null
  onMouseUp?: (pageNumber: number, pageElement: HTMLElement, point: { clientX: number; clientY: number }) => void
  onPointerOrigin?: (x: number, y: number) => void
}

export function PdfPageView({
  pdf,
  pageNumber,
  scale,
  theme,
  marks,
  transientSelection,
  onMouseUp,
  onPointerOrigin,
}: PdfPageViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerHostRef = useRef<HTMLDivElement>(null)
  const marksLayerRef = useRef<SVGSVGElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const renderTaskRef = useRef<RenderTask | null>(null)
  const textLayerBuilderRef = useRef<PdfTextLayerBuilderInstance | null>(null)
  const [rendering, setRendering] = useState(true)
  const [pageViewport, setPageViewport] = useState<PageViewport | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const textLayerHost = textLayerHostRef.current
    const pageRoot = wrapperRef.current
    if (!canvas || !textLayerHost || !pageRoot) return

    let cancelled = false
    let unregisterTextGeometry: (() => void) | undefined
    setRendering(true)
    setPageViewport(null)
    renderTaskRef.current?.cancel()
    renderTaskRef.current = null
    textLayerBuilderRef.current?.cancel()
    textLayerBuilderRef.current = null
    textLayerHost.replaceChildren()
    const textLayerBuilderClassPromise = loadPdfTextLayerBuilder()

    void (async () => {
      try {
        const page = await pdf.getPage(pageNumber)
        if (cancelled) return

        const { cssViewport, cssWidth, cssHeight, canvasWidth, canvasHeight, transform } =
          createPdfPageViewport(page, scale)
        const textContentPromise = page.getTextContent({
          includeMarkedContent: true,
          disableNormalization: true,
        })

        pageRoot.style.setProperty('--scale-factor', String(cssViewport.scale))
        pageRoot.style.setProperty('--user-unit', String(cssViewport.userUnit))
        pageRoot.style.width = `${cssWidth}px`
        pageRoot.style.height = `${cssHeight}px`
        setPageViewport(cssViewport)

        canvas.width = canvasWidth
        canvas.height = canvasHeight
        canvas.style.width = '100%'
        canvas.style.height = '100%'

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

        const TextLayerBuilder = await textLayerBuilderClassPromise
        if (cancelled) return
        const textMapping = new PdfTextLayerMappingSink()
        const textLayerBuilder = new TextLayerBuilder({
          pdfPage: page,
          // TextLayerBuilder 仅通过这三个公开方法使用 highlighter；这里借该 hook 记录 item 映射。
          highlighter: textMapping,
          onAppend: (textLayer: HTMLDivElement) => {
            if (!cancelled) textLayerHost.replaceChildren(textLayer)
          },
        })
        textLayerBuilder.div.setAttribute('aria-hidden', 'false')
        textLayerBuilderRef.current = textLayerBuilder
        await textLayerBuilder.render({
          viewport: cssViewport,
          // 与官方 PDFPageView 一致：未启用文字层图片占位时传 null。
          images: null,
        })
        if (cancelled) return
        const textContent = await textContentPromise
        if (cancelled) return
        unregisterTextGeometry = registerPdfPageTextGeometry(pageRoot, cssViewport, textContent)
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
      renderTaskRef.current?.cancel()
      renderTaskRef.current = null
      textLayerBuilderRef.current?.cancel()
      textLayerBuilderRef.current = null
      unregisterTextGeometry?.()
      textLayerHost.replaceChildren()
    }
  }, [pageNumber, pdf, scale])

  useEffect(() => {
    const marksLayer = marksLayerRef.current
    if (!marksLayer || !pageViewport) return
    renderPdfMarkOverlays(
      marksLayer,
      marks,
      pageNumber,
      theme,
      pageViewport,
      transientSelection,
    )
  }, [marks, pageNumber, pageViewport, theme, transientSelection])

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
      <div ref={textLayerHostRef} className="pdf-text-layer-host" />
      <svg ref={marksLayerRef} className="pdf-marks-layer" aria-hidden="true" />
    </div>
  )
}
