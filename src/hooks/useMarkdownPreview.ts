import { useEffect, useState } from 'react'
import DOMPurify from 'dompurify'
import { markdownParser } from '@/lib/markdown'

export function useMarkdownPreview(content: string, delay = 300): string {
  const [html, setHtml] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const raw = markdownParser.render(content)
      setHtml(DOMPurify.sanitize(raw))
    }, delay)

    return () => window.clearTimeout(timer)
  }, [content, delay])

  return html
}
