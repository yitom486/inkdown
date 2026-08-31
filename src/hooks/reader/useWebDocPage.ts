import { useQuery } from '@tanstack/react-query'
import { webDocApi } from '@/api/web-doc-api'
import { queryKeys } from '@/api/query-keys'
import { buildWebDocPageContent } from '@/lib/reader/web-doc-html'
import { resolveWebDocSiteId } from '@/lib/reader/web-doc-site'
import { isOk } from '@shared/core/result'
import type { AppError } from '@shared/core/errors'
import type { WebDocPageContent } from '@shared/types/web-doc'

export interface WebDocPageData {
  pageUrl: string
  content: WebDocPageContent
}

async function fetchWebDocPageData(pageUrl: string): Promise<WebDocPageData> {
  const result = await webDocApi.fetchPage({ url: pageUrl })
  if (!isOk(result)) {
    throw result.error satisfies AppError
  }

  const content = buildWebDocPageContent(
    result.value.html,
    result.value.url,
    resolveWebDocSiteId(result.value.url),
  )
  return {
    pageUrl: result.value.url,
    content,
  }
}

export function useWebDocPage(pageUrl: string | null | undefined) {
  const safeUrl = pageUrl?.trim() || null

  return useQuery<WebDocPageData, AppError>({
    queryKey: queryKeys.webDocPage(safeUrl ?? ''),
    enabled: Boolean(safeUrl),
    queryFn: () => fetchWebDocPageData(safeUrl!),
    staleTime: 60_000,
  })
}
