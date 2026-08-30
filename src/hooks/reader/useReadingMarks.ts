import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { readingMarksApi } from '@/api/reading-marks-api'
import { queryKeys } from '@/api/query-keys'
import { isOk } from '@shared/core/result'
import type { CreateReadingMarkPayload, UpdateReadingMarkPayload } from '@shared/types/reading-mark'
import { reportAppError } from '@/lib/workspace/report-error'

export function useReadingMarks(filePath: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.readingMarks(filePath),
    queryFn: async () => {
      const result = await readingMarksApi.list(filePath)
      if (!isOk(result)) {
        throw result.error
      }
      return result.value
    },
    enabled: Boolean(filePath),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.readingMarks(filePath) })
  }

  const createMutation = useMutation({
    mutationFn: (payload: CreateReadingMarkPayload) => readingMarksApi.create(payload),
    onSuccess: (result) => {
      if (!isOk(result)) {
        reportAppError(result.error)
        return
      }
      invalidate()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateReadingMarkPayload) => readingMarksApi.update(payload),
    onSuccess: (result) => {
      if (!isOk(result)) {
        reportAppError(result.error)
        return
      }
      invalidate()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => readingMarksApi.remove(id),
    onSuccess: (result) => {
      if (!isOk(result)) {
        reportAppError(result.error)
        return
      }
      invalidate()
    },
  })

  return {
    marks: query.data ?? [],
    isLoading: query.isLoading,
    createMark: createMutation.mutateAsync,
    updateMark: updateMutation.mutateAsync,
    deleteMark: deleteMutation.mutateAsync,
  }
}
