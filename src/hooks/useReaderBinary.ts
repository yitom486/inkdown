import { useQuery } from '@tanstack/react-query'
import { fileApi } from '@/api/file-api'
import { queryKeys } from '@/api/query-keys'
import { isOk } from '@shared/result'
import type { AppError } from '@shared/errors'

export function useReaderBinary(filePath?: string) {
  return useQuery({
    queryKey: queryKeys.readBinary(filePath ?? ''),
    queryFn: async () => {
      const result = await fileApi.readBinaryFile(filePath!)
      if (!isOk(result)) {
        throw result.error
      }
      return result.value
    },
    enabled: Boolean(filePath),
    staleTime: Infinity,
    retry: false,
  })
}
