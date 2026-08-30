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
  const canvasHostRef = useRef<HTMLDivElement>(null)
  const textLayerHostRef = useRef<HTMLDivElement>(null)
  const marksLayerRef = useRef<SVGSVGElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const geometryDisposeRef = useRef<(() => void) | null>(null)
  const committedSourceRef = useRef<{ pdf: PDFDocumentProxy; pageNumber: number } | null>(null)
  const [rendering, setRendering] = useState(true)
  const [hasCommittedPage, setHasCommittedPage] = useState(false)
  const [pageViewport, setPageViewport] = useState<PageViewport | null>(null)

  useEffect(() => {
    const canvasHost = canvasHostRef.current
    const textLayerHost = textLayerHostRef.current
    const pageRoot = wrapperRef.current
    if (!canvasHost || !textLayerHost || !pageRoot) return

    let cancelled = false
    let renderTask: RenderTask | null = null
    let textLayerBuilder: PdfTextLayerBuilderInstance | null = null
    const keepsCurrentPage =
      committedSourceRef.current?.pdf === pdf && committedSourceRef.current.pageNumber === pageNumber
    setRendering(true)
    if (!keepsCurrentPage) setHasCommittedPage(false)
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

        // 缩放时保留上一帧可见页面；新 canvas 在脱离 DOM 的状态下完成绘制后才替换。
        // 初次加载或切换文档没有可复用页面，先给容器一个正确的占位尺寸。
        if (!keepsCurrentPage) {
          pageRoot.style.setProperty('--scale-factor', String(cssViewport.scale))
          pageRoot.style.setProperty('--user-unit', String(cssViewport.userUnit))
          pageRoot.style.width = `${cssWidth}px`
          pageRoot.style.height = `${cssHeight}px`
        }

        const canvas = document.createElement('canvas')
        canvas.width = canvasWidth
        canvas.height = canvasHeight
        canvas.style.width = '100%'
        canvas.style.height = '100%'

        const context = canvas.getContext('2d', { alpha: false })
        if (!context) return
        context.setTransform(1, 0, 0, 1, 0, 0)

        renderTask = page.render({
          canvasContext: context,
          viewport: cssViewport,
          transform,
          canvas,
          background: '#ffffff',
        })
        await renderTask.promise
        renderTask = null
        if (cancelled) return

        const TextLayerBuilder = await textLayerBuilderClassPromise
        if (cancelled) return
        const textMapping = new PdfTextLayerMappingSink()
        let renderedTextLayer: HTMLDivElement | null = null
        textLayerBuilder = new TextLayerBuilder({
          pdfPage: page,
          // TextLayerBuilder 仅通过这三个公开方法使用 highlighter；这里借该 hook 记录 item 映射。
          highlighter: textMapping,
          onAppend: (textLayer: HTMLDivElement) => {
            renderedTextLayer = textLayer
          },
        })
        textLayerBuilder.div.setAttribute('aria-hidden', 'false')
        await textLayerBuilder.render({
          viewport: cssViewport,
          // 与官方 PDFPageView 一致：未启用文字层图片占位时传 null。
          images: null,
        })
        const completedTextLayerBuilder = textLayerBuilder
        textLayerBuilder = null
        if (cancelled) return
        const textContent = await textContentPromise
        if (cancelled) return

        // 同步提交三层，避免 canvas、文字层和 SVG 标记在不同帧短暂错位。
        pageRoot.style.setProperty('--scale-factor', String(cssViewport.scale))
        pageRoot.style.setProperty('--user-unit', String(cssViewport.userUnit))
        pageRoot.style.width = `${cssWidth}px`
        pageRoot.style.height = `${cssHeight}px`
        canvasHost.replaceChildren(canvas)
        textLayerHost.replaceChildren(renderedTextLayer ?? completedTextLayerBuilder.div)
        geometryDisposeRef.current?.()
        geometryDisposeRef.current = registerPdfPageTextGeometry(pageRoot, cssViewport, textContent)
        committedSourceRef.current = { pdf, pageNumber }
        setPageViewport(cssViewport)
        setHasCommittedPage(true)
      } catch (cause) {
        if (!cancelled && !isPdfRenderCancelled(cause)) {
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
      renderTask?.cancel()
      textLayerBuilder?.cancel()
    }
  }, [pageNumber, pdf, scale])

  useEffect(() => {
    return () => {
      geometryDisposeRef.current?.()
      geometryDisposeRef.current = null
    }
  }, [])

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
      {rendering && !hasCommittedPage ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-sm bg-white/90 dark:bg-zinc-800/90">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : null}
      <div ref={canvasHostRef} className="pdf-canvas-host" />
      <div ref={textLayerHostRef} className="pdf-text-layer-host" />
      <svg ref={marksLayerRef} className="pdf-marks-layer" aria-hidden="true" />
    </div>
  )
}
