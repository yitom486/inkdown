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
