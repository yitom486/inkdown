import DOMPurify from 'dompurify'
import type { WebDocPageContent, WebDocSiteId } from '@shared/types/web-doc'
import { stripWebDocChrome } from '@/lib/reader/web-doc-chrome'
import { buildReaderLayoutCss, type EpubThemeMode } from '@/lib/reader/epub-themes'
import { DEFAULT_READER_TYPOGRAPHY, type ReaderTypography } from '@/lib/reader/reader-typography'
import { buildWebDocCodeBlockCss, buildWebDocTabsRuntimeScript, enhanceWebDocCodeBlocks } from '@/lib/reader/web-doc-code-blocks'
import {
  buildWebDocEmbedCss,
  normalizeAllowedWebDocEmbeds,
  stripDisallowedWebDocEmbeds,
} from '@/lib/reader/web-doc-embeds'
import {
  buildWebDocKatexStylesheetLink,
  buildWebDocMathCss,
  enhanceWebDocMath,
} from '@/lib/reader/web-doc-math'
import { neutralizeWebDocNavigationLinks } from '@/lib/reader/web-doc-link'
import { ensureWebDocHeadingIds } from '@/lib/reader/web-doc-outline'
import {
  extractPeopleDailyTitle,
  pickPeopleDailyArticleRoot,
} from '@/lib/reader/web-doc/people-daily-extract'
import { pickHrttArticleRoot } from '@/lib/reader/web-doc/hrtt-extract'

const GENERIC_ARTICLE_SELECTORS = [
  'article.md-content__inner',
  '.md-content__inner.md-typeset',
  '.md-content__inner',
  'article',
  'main',
  '[role="main"]',
  '.markdown',
  '#__next main',
  '.docs-content',
  '.doc-content',
  '.md-typeset',
  '.md-content',
  '.content',
]

const SITE_ARTICLE_SELECTORS: Partial<Record<WebDocSiteId, string[]>> = {}

/** 选择器赢家小于此字符数、且 body 远大于此 → 视为被导航碎片截胡，进密度兜底 */
const TINY_WINNER_TEXT = 500
const DENSE_BODY_TEXT = 2000

/** 计分时直接丢弃的子树：脚本样式与站点头尾导航（正文不可能住里面） */
const NON_CONTENT_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'HEADER',
  'FOOTER',
  'NAV',
  'ASIDE',
  'FORM',
])
const NON_CONTENT_ROLES = new Set([
  'navigation',
  'banner',
  'contentinfo',
  'complementary',
  'search',
])

function isNonContentElement(el: Element): boolean {
  if (NON_CONTENT_TAGS.has(el.tagName)) return true
  const role = el.getAttribute('role')?.toLowerCase()
  return role ? NON_CONTENT_ROLES.has(role) : false
}

/**
 * 密度兜底：在 body 内单遍统计每块的可见文本量与其中链接文本量，
 * 取"非链接文本最多"的 div/section/article/main。
 * body 本人不参选（它是"放弃治疗"选项，由调用方在无块可选时再退）；
 * 调用方可把原选择器赢家也送进来（不过滤长度下限，避免短正文被链接农场反超）。
 * 只解决"赢家是导航碎片"类问题；短页面不进此路径（见 pickArticleRoot）。
 */
function pickDensestContentRoot(
  body: HTMLElement,
  keepWinner?: HTMLElement | null,
): HTMLElement | null {
  const totals = new Map<Element, number>()
  const linkText = new Map<Element, number>()
  const bump = (map: Map<Element, number>, el: Element, n: number): void => {
    map.set(el, (map.get(el) ?? 0) + n)
  }

  const walker = body.ownerDocument.createTreeWalker(body, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? ''
    if (!text.trim()) continue
    const chain: Element[] = []
    let el: Element | null = node.parentElement
    let blocked = false
    let inLink = false
    while (el) {
      if (isNonContentElement(el)) {
        blocked = true
        break
      }
      chain.push(el)
      if (el.tagName === 'A') inLink = true
      if (el === body) break
      el = el.parentElement
    }
    if (blocked) continue
    for (const ancestor of chain) {
      bump(totals, ancestor, text.length)
      if (inLink) bump(linkText, ancestor, text.length)
    }
  }

  let best: HTMLElement | null = null
  let bestScore = 0
  let bestText = 0
  const consider = (el: HTMLElement, ignoreFloor = false): void => {
    if (isNonContentElement(el)) return
    const text = totals.get(el) ?? 0
    if (!ignoreFloor && text < TINY_WINNER_TEXT) return
    const score = text - (linkText.get(el) ?? 0)
    if (score > bestScore || (score === bestScore && text > bestText)) {
      best = el
      bestScore = score
      bestText = text
    }
  }
  body.querySelectorAll('div, section, article, main').forEach((el) => {
    if (el instanceof HTMLElement) consider(el)
  })
  if (keepWinner) consider(keepWinner, true)
  return best
}

export function pickArticleRoot(
  doc: Document,
  siteId: WebDocSiteId = 'generic-ssr',
  pageUrl?: string,
): HTMLElement {
  if (siteId === 'people-daily-paper' && pageUrl) {
    return pickPeopleDailyArticleRoot(doc, pageUrl)
  }
  if (siteId === 'hrtt-news') {
    return pickHrttArticleRoot(doc)
  }

  const selectors = SITE_ARTICLE_SELECTORS[siteId] ?? GENERIC_ARTICLE_SELECTORS
  let winner: HTMLElement | null = null
  for (const selector of selectors) {
    const node = doc.querySelector(selector)
    if (node instanceof HTMLElement && node.textContent?.trim()) {
      winner = node
      break
    }
  }

  const body = doc.body
  const bodyText = body?.textContent?.trim() ?? ''
  // 仅当赢家缺失或过小（如 37 字导航碎片）且页面文本很长时进密度兜底；
  // 正常命中的大正文块原样返回，零回归面。短页面保持原行为。
  if (bodyText.length >= DENSE_BODY_TEXT && body instanceof HTMLElement) {
    const winnerTiny = !winner || (winner.textContent?.trim().length ?? 0) < TINY_WINNER_TEXT
    if (winnerTiny) {
      // 无块可选再退整 body（下游 chrome 清洗），也好过碎片
      return pickDensestContentRoot(body, winner) ?? body
    }
  }
  if (winner) return winner

  if (body instanceof HTMLElement && bodyText) {
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
  doc.querySelectorAll('form, map, area').forEach((node) => node.remove())
  stripDisallowedWebDocEmbeds(doc)
  normalizeAllowedWebDocEmbeds(doc)
  const root = doc.getElementById('web-doc-root')
  const inner = root?.innerHTML ?? html

  const cleaned = DOMPurify.sanitize(inner, {
    ADD_TAGS: [
      'img',
      'svg',
      'video',
      'audio',
      'picture',
      'source',
      'pre',
      'code',
      'h1',
      'h2',
      'h3',
      'section',
      'nav',
      'iframe',
      'details',
      'summary',
    ],
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
      'referrerpolicy',
      'allow',
      'allowfullscreen',
      'open',
    ],
  })

  // DOMPurify 放行 iframe 标签后，再按白名单收紧
  const gated = new DOMParser().parseFromString(`<div id="web-doc-root">${cleaned}</div>`, 'text/html')
  stripDisallowedWebDocEmbeds(gated)
  normalizeAllowedWebDocEmbeds(gated)
  return gated.getElementById('web-doc-root')?.innerHTML ?? cleaned
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
  const mathCss = buildWebDocMathCss()
  const embedCss = buildWebDocEmbedCss()
  const safeTitle = DOMPurify.sanitize(content.title)
  const body = neutralizeWebDocNavigationLinks(
    enhanceWebDocCodeBlocks(enhanceWebDocMath(content.bodyHtml)),
    content.baseUrl,
  )

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  ${buildWebDocKatexStylesheetLink()}
  <style>${layoutCss}</style>
  <style>${codeBlockCss}</style>
  <style>${mathCss}</style>
  <style>${embedCss}</style>
  <style>
    body { margin: 0; padding: 1.25rem 1.5rem 2rem; }
    a { word-break: break-word; }
    a[data-inkdown-href] { cursor: pointer; }
    pre { overflow-x: auto; }
    img { max-width: 100%; height: auto; }
    /* 无宽高的图标 SVG（如「编辑此页」）否则会按 viewBox 撑满版面 */
    svg { max-width: 100%; height: auto; max-height: min(70vh, 28rem); }
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
<body>${body}${buildWebDocTabsRuntimeScript()}</body>
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
