import DOMPurify from 'dompurify'
import type { WebDocPageContent, WebDocSiteId } from '@shared/types/web-doc'
import { stripWebDocChrome } from '@/lib/reader/web-doc-chrome'
import { buildReaderLayoutCss, type EpubThemeMode } from '@/lib/reader/epub-themes'
import { DEFAULT_READER_TYPOGRAPHY, type ReaderTypography } from '@/lib/reader/reader-typography'
import { buildWebDocCodeBlockCss, enhanceWebDocCodeBlocks } from '@/lib/reader/web-doc-code-blocks'
import { neutralizeWebDocNavigationLinks } from '@/lib/reader/web-doc-link'
import { ensureWebDocHeadingIds } from '@/lib/reader/web-doc-outline'
import {
  extractPeopleDailyTitle,
  pickPeopleDailyArticleRoot,
} from '@/lib/reader/web-doc/people-daily-extract'

const GENERIC_ARTICLE_SELECTORS = [
  'article',
  'main',
  '[role="main"]',
  '.markdown',
  '#__next main',
  '.docs-content',
  '.doc-content',
  '.content',
]

const SITE_ARTICLE_SELECTORS: Partial<Record<WebDocSiteId, string[]>> = {}

export function pickArticleRoot(
  doc: Document,
  siteId: WebDocSiteId = 'generic-ssr',
  pageUrl?: string,
): HTMLElement {
  if (siteId === 'people-daily-paper' && pageUrl) {
    return pickPeopleDailyArticleRoot(doc, pageUrl)
  }

  const selectors = SITE_ARTICLE_SELECTORS[siteId] ?? GENERIC_ARTICLE_SELECTORS
  for (const selector of selectors) {
    const node = doc.querySelector(selector)
    if (node instanceof HTMLElement && node.textContent?.trim()) {
      return node
    }
  }

  const body = doc.body
  if (body instanceof HTMLElement && body.textContent?.trim()) {
    return body
  }

  const fallback = doc.createElement('div')
  fallback.textContent = '未能提取正文'
  return fallback
}

function parseHtmlDocument(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

export function extractDocumentTitle(doc: Document): string {
  const h1 = doc.querySelector('article h1, main h1, .article h1, h1')
  const h1Text = h1?.textContent?.replace(/\s+/g, ' ').trim()
  if (h1Text) return h1Text

  const title = doc.querySelector('title')?.textContent?.replace(/\s+/g, ' ').trim()
  if (title) return title

  return '未命名页面'
}
export function rewriteRelativeUrls(root: HTMLElement, baseUrl: string): void {
  const base = new URL(baseUrl)

  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href')?.trim()
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return
    }
    try {
      anchor.setAttribute('href', new URL(href, base).toString())
    } catch {
      anchor.removeAttribute('href')
    }
  })

  root.querySelectorAll<HTMLImageElement>('img[src]').forEach((img) => {
    const src = img.getAttribute('src')?.trim()
    if (!src) return
    try {
      img.setAttribute('src', new URL(src, base).toString())
    } catch {
      img.removeAttribute('src')
    }
  })

  root.querySelectorAll<HTMLSourceElement>('source[src]').forEach((source) => {
    const src = source.getAttribute('src')?.trim()
    if (!src) return
    try {
      source.setAttribute('src', new URL(src, base).toString())
    } catch {
      source.removeAttribute('src')
    }
  })
}

export function sanitizeWebDocBodyHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div id="web-doc-root">${html}</div>`, 'text/html')
  doc.querySelectorAll('script, iframe, object, embed, form, map, area').forEach((node) => node.remove())
  const root = doc.getElementById('web-doc-root')
  const inner = root?.innerHTML ?? html

  return DOMPurify.sanitize(inner, {
    ADD_TAGS: ['img', 'svg', 'video', 'audio', 'picture', 'source', 'pre', 'code', 'h1', 'h2', 'h3', 'section', 'nav'],
    ADD_ATTR: [
      'href',
      'class',
      'id',
      'style',
      'src',
      'alt',
      'title',
      'target',
      'rel',
      'width',
      'height',
      'loading',
      'aria-hidden',
      'role',
      'data-inkdown-href',
    ],
  })
}

export function extractWebDocArticle(
  html: string,
  pageUrl: string,
  siteId: WebDocSiteId = 'generic-ssr',
): { title: string; bodyHtml: string } {
  const doc = parseHtmlDocument(html)
  const root = pickArticleRoot(doc, siteId, pageUrl)
  const clone = root.cloneNode(true) as HTMLElement
  stripWebDocChrome(clone, siteId)
  rewriteRelativeUrls(clone, pageUrl)
  const sanitized = sanitizeWebDocBodyHtml(clone.innerHTML)
  const { bodyHtml } = ensureWebDocHeadingIds(sanitized)
  const title =
    (siteId === 'people-daily-paper' ? extractPeopleDailyTitle(doc, pageUrl) : null) ??
    extractDocumentTitle(doc)
  return {
    title,
    bodyHtml,
  }
}

export function buildWebDocReaderDocument(
  content: Pick<WebDocPageContent, 'title' | 'bodyHtml' | 'baseUrl'>,
  theme: EpubThemeMode,
  typography: ReaderTypography = DEFAULT_READER_TYPOGRAPHY,
): string {
  const layoutCss = buildReaderLayoutCss(theme, typography)
  const codeBlockCss = buildWebDocCodeBlockCss(theme)
  const safeTitle = DOMPurify.sanitize(content.title)
  const body = neutralizeWebDocNavigationLinks(
    enhanceWebDocCodeBlocks(content.bodyHtml),
    content.baseUrl,
  )

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>${layoutCss}</style>
  <style>${codeBlockCss}</style>
  <style>
    body { margin: 0; padding: 1.25rem 1.5rem 2rem; }
    a { word-break: break-word; }
    a[data-inkdown-href] { cursor: pointer; }
    pre { overflow-x: auto; }
    img { max-width: 100%; height: auto; }
    .people-daily-edition-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem 0.75rem;
      list-style: none;
      padding: 0;
      margin: 0 0 1.25rem;
    }
    .people-daily-edition-nav a {
      text-decoration: none;
      opacity: 0.85;
    }
    .people-daily-edition-nav a:hover {
      text-decoration: underline;
      opacity: 1;
    }
  </style>
</head>
<body>${body}</body>
</html>`
}

export function buildWebDocPageContent(
  html: string,
  pageUrl: string,
  siteId: WebDocSiteId,
): WebDocPageContent {
  const article = extractWebDocArticle(html, pageUrl, siteId)
  return {
    ...article,
    baseUrl: pageUrl,
    siteId,
  }
}
