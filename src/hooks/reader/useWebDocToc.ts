import { useQuery } from '@tanstack/react-query'
import { webDocApi } from '@/api/web-doc-api'
import { queryKeys } from '@/api/query-keys'
import { isOk } from '@shared/core/result'
import type { AppError } from '@shared/core/errors'
import type { WebDocDiscoverTocResult } from '@shared/types/web-doc'

async function fetchWebDocToc(discoveryUrl: string): Promise<WebDocDiscoverTocResult> {
  const result = await webDocApi.discoverToc({ url: discoveryUrl })
  if (!isOk(result)) {
    throw result.error satisfies AppError
  }
  return result.value
}

export function useWebDocToc(discoveryUrl: string | null | undefined) {
  const safeUrl = discoveryUrl?.trim() || null

  return useQuery<WebDocDiscoverTocResult, AppError>({
    queryKey: queryKeys.webDocToc(safeUrl ?? ''),
    enabled: Boolean(safeUrl),
    queryFn: () => fetchWebDocToc(safeUrl!),
    staleTime: 5 * 60_000,
  })
}
