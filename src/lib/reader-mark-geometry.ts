import type { PdfTextRect } from '@shared/types/reading-mark'

export function getReaderScrollRoot(doc: Document): HTMLElement {
  const scrolling = doc.scrollingElement
  if (scrolling instanceof HTMLElement) return scrolling
  return doc.documentElement
}

/** 将选区坐标转为相对全章滚动内容的 0–1 比例（MOBI/AZW3 iframe 内使用） */
export function normalizeRectsInScrollDocument(
  clientRects: DOMRectList | DOMRect[],
  doc: Document,
  contentRoot: HTMLElement,
): PdfTextRect[] {
  const scrollRoot = getReaderScrollRoot(doc)
  const items = 'length' in clientRects ? Array.from(clientRects) : [clientRects]
  const contentRect = contentRoot.getBoundingClientRect()
  const width = scrollRoot.clientWidth || contentRoot.clientWidth
  const height = Math.max(scrollRoot.scrollHeight, contentRoot.scrollHeight)

  if (width <= 0 || height <= 0) return []

  const rects: PdfTextRect[] = []
  for (const rect of items) {
    if (rect.width <= 0 || rect.height <= 0) continue
    rects.push({
      x: (rect.left - contentRect.left) / width,
      y: (rect.top - contentRect.top) / height,
      width: rect.width / width,
      height: rect.height / height,
    })
  }
  return rects
}

export function buildMobiMarkStylesCss(theme: 'dark' | 'light'): string {
  const highlight =
    theme === 'dark' ? 'rgba(122, 162, 247, 0.28)' : 'rgba(59, 130, 246, 0.22)'
  const noteStroke = theme === 'dark' ? '#fbbf24' : '#d97706'

  return `
    body {
      position: relative !important;
    }
    #reader-mark-layer {
      position: absolute !important;
      inset: 0 auto auto 0 !important;
      width: 100% !important;
      height: 100% !important;
      pointer-events: none !important;
      z-index: 4 !important;
      margin: 0 !important;
      padding: 0 !important;
      background: transparent !important;
    }
    span.mobi-mark-highlight,
    #reader-mark-layer .mobi-mark-highlight {
      border-radius: 2px;
      background: ${highlight} !important;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
    }
    span.mobi-mark-note {
      background: transparent !important;
      border-bottom: none !important;
      text-decoration-line: underline !important;
      text-decoration-style: dashed !important;
      text-decoration-color: ${noteStroke} !important;
      text-decoration-thickness: 2px !important;
      text-underline-offset: 3px !important;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
      cursor: default;
      pointer-events: auto !important;
    }
    #reader-mark-layer .mobi-mark-note-hit {
      background: transparent !important;
      pointer-events: auto !important;
    }
    #reader-mark-layer .mobi-mark-note-hit::after {
      content: '' !important;
      position: absolute !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      height: 0 !important;
      border-bottom: 2px dashed ${noteStroke} !important;
      pointer-events: none !important;
    }
    #reader-mark-layer .mobi-mark-highlight {
      position: absolute !important;
      pointer-events: none !important;
    }
    #reader-mark-layer .mobi-mark-note {
      position: absolute !important;
      pointer-events: auto !important;
    }
  `
}

export function injectMobiMarkStyles(doc: Document, theme: 'dark' | 'light'): void {
  const styleId = 'reader-mobi-mark-styles'
  let style = doc.getElementById(styleId) as HTMLStyleElement | null
  if (!style) {
    style = doc.createElement('style')
    style.id = styleId
    doc.head.appendChild(style)
  }
  style.textContent = buildMobiMarkStylesCss(theme)
}
