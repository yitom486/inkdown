import DOMPurify, { type Config } from 'dompurify'
import { fileApi } from '@/api/file-api'
import {
  buildImageReplacements,
  extractLocalImageRefsFromHtml,
  replaceImageSrcInHtml,
} from '@/lib/markdown-images'
import { markdownParser } from '@/lib/markdown'
import { isOk } from '@shared/result'

const PREVIEW_SANITIZE_OPTIONS: Config = {
  ALLOWED_URI_REGEXP:
    /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  ADD_TAGS: ['input'],
  ADD_ATTR: ['type', 'checked', 'disabled'],
}

const EXPORT_STYLES = `
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.7; color: #1f2937; max-width: 860px; margin: 2rem auto; padding: 0 1.5rem; }
h1,h2,h3,h4,h5,h6 { line-height: 1.25; margin: 1.25rem 0 0.75rem; }
p,ul,ol,pre,blockquote { margin: 0.75rem 0; }
pre,code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
pre { overflow: auto; padding: 0.75rem 1rem; background: #f3f4f6; border-radius: 0.375rem; }
blockquote { border-left: 4px solid #d1d5db; padding-left: 1rem; color: #4b5563; }
table { border-collapse: collapse; width: 100%; }
th,td { border: 1px solid #d1d5db; padding: 0.5rem 0.75rem; }
img { max-width: 100%; height: auto; }
.code-block { margin: 1rem 0; border: 1px solid #e5e7eb; border-radius: 0.375rem; overflow: hidden; }
.code-block pre { margin: 0; border-radius: 0; }
`

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

export async function buildExportHtml(content: string, filePath?: string): Promise<string> {
  const env: { headingSlugCounts: Map<string, number> } = {
    headingSlugCounts: new Map(),
  }
  const raw = markdownParser.render(content, env)
  const withImages = await resolveLocalImagesInHtml(raw, filePath)
  const body = String(DOMPurify.sanitize(withImages, PREVIEW_SANITIZE_OPTIONS))

  const title = filePath?.split(/[/\\]/).pop() ?? 'Markdown Export'

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>${EXPORT_STYLES}</style>
</head>
<body>
  <article class="markdown-preview">${body}</article>
</body>
</html>`
}

export function getSuggestedExportName(filePath: string | undefined, extension: 'html' | 'pdf'): string {
  if (!filePath) return `export.${extension}`
  const base = filePath.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') ?? 'export'
  return `${base}.${extension}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
