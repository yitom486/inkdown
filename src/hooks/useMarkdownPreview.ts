import { useEffect, useState } from 'react'
import DOMPurify, { type Config } from 'dompurify'
import { fileApi } from '@/api/file-api'
import {
  buildImageReplacements,
  extractLocalImageRefsFromHtml,
  replaceImageSrcInHtml,
} from '@/lib/markdown-images'
import { markdownParser } from '@/lib/markdown'
import { reportRuntimeError } from '@/lib/error-reporter'
import { isOk } from '@shared/result'

const PREVIEW_SANITIZE_OPTIONS: Config = {
  ALLOWED_URI_REGEXP:
    /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  ADD_TAGS: ['input'],
  ADD_ATTR: ['type', 'checked', 'disabled'],
}

async function resolveLocalImagesInHtml(
  html: string,
  filePath: string | undefined,
): Promise<string> {
  const localRefs = extractLocalImageRefsFromHtml(html, filePath)
  if (localRefs.length === 0) return html

  const dataUrlsByAbsolutePath: Record<string, string | undefined> = {}
  const uniquePaths = [...new Set(localRefs.map((ref) => ref.absolutePath))]

  await Promise.all(
    uniquePaths.map(async (absolutePath) => {
      const result = await fileApi.readImage(absolutePath)
      if (isOk(result)) {
        dataUrlsByAbsolutePath[absolutePath] = result.value.dataUrl
      }
    }),
  )

  const replacements = buildImageReplacements(localRefs, dataUrlsByAbsolutePath)
  return replaceImageSrcInHtml(html, replacements)
}

export function useMarkdownPreview(content: string, filePath?: string, delay = 300): string {
  const [html, setHtml] = useState('')

  useEffect(() => {
    let cancelled = false

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const env: { headingSlugCounts: Map<string, number> } = {
            headingSlugCounts: new Map(),
          }
          const raw = markdownParser.render(content, env)
          const withImages = await resolveLocalImagesInHtml(raw, filePath)

          if (!cancelled) {
            setHtml(String(DOMPurify.sanitize(withImages, PREVIEW_SANITIZE_OPTIONS)))
          }
        } catch (error) {
          console.error('[useMarkdownPreview]', error)
          if (!cancelled) {
            setHtml('')
          }
          reportRuntimeError(error, { source: 'preview', filePath })
        }
      })()
    }, delay)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [content, filePath, delay])

  return html
}
