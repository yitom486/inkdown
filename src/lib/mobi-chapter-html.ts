import DOMPurify from 'dompurify'
import type { MobiProcessedChapter } from '@lingo-reader/mobi-parser'

export function buildMobiChapterHtml(chapter: MobiProcessedChapter): string {
  const cssLinks = chapter.css
    .map((part) => `<link rel="stylesheet" href="${part.href}" />`)
    .join('')

  const sanitized = DOMPurify.sanitize(chapter.html, {
    ADD_TAGS: ['link'],
    ADD_ATTR: ['href', 'rel', 'class', 'id', 'style'],
  })

  return `${cssLinks}${sanitized}`
}

export function renderMobiMarkHighlights(
  container: HTMLElement,
  rects: Array<{ x: number; y: number; width: number; height: number }>,
  kind: 'highlight' | 'note',
  theme: 'dark' | 'light',
): void {
  for (const rect of rects) {
    const overlay = document.createElement('div')
    overlay.className = kind === 'note' ? 'mobi-mark-note' : 'mobi-mark-highlight'
    overlay.dataset.theme = theme
    overlay.style.position = 'absolute'
    overlay.style.left = `${rect.x * 100}%`
    overlay.style.top = `${rect.y * 100}%`
    overlay.style.width = `${rect.width * 100}%`
    overlay.style.height = `${rect.height * 100}%`
    overlay.style.pointerEvents = 'none'
    container.appendChild(overlay)
  }
}
