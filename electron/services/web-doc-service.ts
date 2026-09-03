import { err, ok, type Result } from '@shared/core/result'
import type { AppError } from '@shared/core/errors'
import { toAppError } from '@shared/core/errors'
import type {
  WebDocDiscoverTocPayload,
  WebDocDiscoverTocResult,
  WebDocFetchPayload,
  WebDocFetchResult,
} from '@shared/types/web-doc'
import {
  extractGenericWebDocToc,
  extractSameOriginDocLinks,
} from './web-doc/extract-toc-links'
import {
  extractLlmsTxtToc,
  looksLikeDocsIndexCandidate,
  resolveLlmsTxtUrl,
} from './web-doc/extract-llms-toc'
import { tryFetchE2eWebDocFixture } from './web-doc/e2e-fixture'
import { extractReactDevToc } from './web-doc/adapters/react-dev-toc'
import { extractPeopleDailyToc } from './web-doc/adapters/people-daily-toc'
import { resolveWebDocSiteId } from './web-doc/site-registry'
import { assertWebDocUrlAllowed, normalizeWebDocUrl } from './web-doc/url-policy'

const WEB_DOC_MAX_BYTES = 5 * 1024 * 1024
const WEB_DOC_FETCH_TIMEOUT_MS = 30_000
const WEB_DOC_USER_AGENT =
  'Inkdown/0.2.3 (Electron; +https://github.com/yitom486/inkdown)'

function toFetchError(message: string): Result<never, AppError> {
  return err({ code: 'FILE_READ_ERROR', message })
}

async function readResponseTextLimited(response: Response): Promise<string> {
  const lengthHeader = response.headers.get('content-length')
  if (lengthHeader) {
    const length = Number.parseInt(lengthHeader, 10)
    if (Number.isFinite(length) && length > WEB_DOC_MAX_BYTES) {
      throw new Error(`页面过大（>${Math.floor(WEB_DOC_MAX_BYTES / 1024 / 1024)}MB）`)
    }
  }

  const buffer = await response.arrayBuffer()
  if (buffer.byteLength > WEB_DOC_MAX_BYTES) {
    throw new Error(`页面过大（>${Math.floor(WEB_DOC_MAX_BYTES / 1024 / 1024)}MB）`)
  }

  return new TextDecoder('utf-8', { fatal: false }).decode(buffer)
}

export async function fetchWebDocPage(
  payload: WebDocFetchPayload,
): Promise<Result<WebDocFetchResult, AppError>> {
  try {
    const fixtureResult = await tryFetchE2eWebDocFixture(payload.url)
    if (fixtureResult) return fixtureResult

    const normalized = normalizeWebDocUrl(payload.url)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), WEB_DOC_FETCH_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(normalized, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          'User-Agent': WEB_DOC_USER_AGENT,
        },
      })
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      return toFetchError(`请求失败（HTTP ${response.status}）`)
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      return toFetchError('该链接不是 HTML 文档页')
    }

    const html = await readResponseTextLimited(response)
    if (!html.trim()) {
      return toFetchError('页面内容为空')
    }

    return ok({
      url: response.url || normalized,
      html,
    })
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') {
      return err({ code: 'ACP_TIMEOUT', message: '抓取页面超时' })
    }
    if (cause instanceof Error && cause.message) {
      return toFetchError(cause.message)
    }
    return err(toAppError(cause, '抓取页面失败'))
  }
}

/** 抓取站点目录索引（如 Mintlify `/llms.txt`），允许 text/plain */
async function fetchWebDocPlainText(
  url: string,
): Promise<Result<{ url: string; text: string }, AppError>> {
  try {
    const normalized = normalizeWebDocUrl(url)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), WEB_DOC_FETCH_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(normalized, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          Accept: 'text/plain,text/markdown,text/*;q=0.9,*/*;q=0.8',
          'User-Agent': WEB_DOC_USER_AGENT,
        },
      })
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      return toFetchError(`请求失败（HTTP ${response.status}）`)
    }

    const text = await readResponseTextLimited(response)
    if (!text.trim()) {
      return toFetchError('目录索引为空')
    }

    return ok({
      url: response.url || normalized,
      text,
    })
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') {
      return err({ code: 'ACP_TIMEOUT', message: '抓取目录索引超时' })
    }
    if (cause instanceof Error && cause.message) {
      return toFetchError(cause.message)
    }
    return err(toAppError(cause, '抓取目录索引失败'))
  }
}

export async function discoverWebDocToc(
  payload: WebDocDiscoverTocPayload,
): Promise<Result<WebDocDiscoverTocResult, AppError>> {
  const fetchResult = await fetchWebDocPage({ url: payload.url })
  if (!fetchResult.ok) return fetchResult

  try {
    const pageUrl = new URL(fetchResult.value.url)
    const siteId = resolveWebDocSiteId(pageUrl)
    let entries =
      siteId === 'react-dev'
        ? extractReactDevToc(fetchResult.value.html, fetchResult.value.url)
        : siteId === 'people-daily-paper'
          ? extractPeopleDailyToc(fetchResult.value.html, fetchResult.value.url)
          : extractGenericWebDocToc(fetchResult.value.html, fetchResult.value.url)

    // 站点级索引：凡页面声明 llms.txt / 典型 docs 侧栏，则拉索引统一目录（不绑定域名）
    if (siteId === 'generic-ssr' && looksLikeDocsIndexCandidate(fetchResult.value.html)) {
      const llmsUrl = resolveLlmsTxtUrl(fetchResult.value.url, fetchResult.value.html)
      if (llmsUrl) {
        const llmsResult = await fetchWebDocPlainText(llmsUrl)
        if (llmsResult.ok) {
          const fromLlms = extractLlmsTxtToc(llmsResult.value.text, pageUrl.origin)
          if (fromLlms.length >= 3) {
            entries = fromLlms
          }
        }
      }
    }

    const resolvedEntries =
      entries.length > 0
        ? entries
        : siteId === 'people-daily-paper'
          ? []
          : extractSameOriginDocLinks(fetchResult.value.html, fetchResult.value.url)

    return ok({
      siteId,
      entries: resolvedEntries,
    })
  } catch (cause) {
    return err(toAppError(cause, '解析文档目录失败'))
  }
}

export function validateWebDocUrl(raw: string): Result<string, AppError> {
  try {
    return ok(normalizeWebDocUrl(raw))
  } catch (cause) {
    return err(toAppError(cause, 'URL 无效'))
  }
}

/** 供单测与 handler 校验入参 */
export function parseWebDocUrlInput(raw: unknown): Result<string, AppError> {
  if (typeof raw !== 'string' || !raw.trim()) {
    return err({ code: 'FILE_READ_ERROR', message: 'URL 不能为空' })
  }
  return validateWebDocUrl(raw)
}

export { assertWebDocUrlAllowed }
