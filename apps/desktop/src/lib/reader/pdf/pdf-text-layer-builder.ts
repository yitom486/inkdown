import * as pdfjsLib from 'pdfjs-dist'
import type { PDFPageProxy, PageViewport } from 'pdfjs-dist'

export interface PdfTextLayerBuilderInstance {
  div: HTMLDivElement
  render(options: { viewport: PageViewport; images: null }): Promise<void>
  cancel(): void
}

interface PdfTextLayerBuilderConstructor {
  new (options: {
    pdfPage: PDFPageProxy
    highlighter?: unknown
    onAppend?: (textLayer: HTMLDivElement) => void
  }): PdfTextLayerBuilderInstance
}

let builderConstructorPromise: Promise<PdfTextLayerBuilderConstructor> | null = null

type PdfJsGlobalTarget = {
  pdfjsLib?: typeof pdfjsLib
}

/** 在加载 pdf_viewer.mjs 前提供其 Vite 开发构建所需的 PDF.js 核心导出。 */
export function registerPdfJsGlobal(
  target: PdfJsGlobalTarget = globalThis as typeof globalThis & PdfJsGlobalTarget,
): void {
  target.pdfjsLib ??= pdfjsLib
}

/**
 * pdf_viewer.mjs 的 Vite 开发构建会从 globalThis.pdfjsLib 读取核心导出。
 * 必须先注册核心模块，再触发动态 import；静态 import 会在赋值前执行并造成整页白屏。
 */
export function loadPdfTextLayerBuilder(): Promise<PdfTextLayerBuilderConstructor> {
  registerPdfJsGlobal()
  builderConstructorPromise ??= import('pdfjs-dist/web/pdf_viewer.mjs').then(
    ({ TextLayerBuilder }) => TextLayerBuilder as unknown as PdfTextLayerBuilderConstructor,
  )
  return builderConstructorPromise
}
