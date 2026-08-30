import { useEffect, useRef } from 'react'
import type { AutoSaveIntervalMs } from '@/stores/app-settings-store'

interface UseAutoSaveOptions {
  enabled: boolean
  intervalMs: AutoSaveIntervalMs
  isDirty: boolean
  filePath?: string
  isSaving: boolean
  onAutoSave: () => Promise<unknown>
}

export function useAutoSave({
  enabled,
  intervalMs,
  isDirty,
  filePath,
  isSaving,
  onAutoSave,
}: UseAutoSaveOptions) {
  const onAutoSaveRef = useRef(onAutoSave)

  onAutoSaveRef.current = onAutoSave

  useEffect(() => {
    if (!enabled || !filePath || !isDirty || isSaving) return

    const timer = window.setInterval(() => {
      void onAutoSaveRef.current()
    }, intervalMs)

    return () => window.clearInterval(timer)
  }, [enabled, filePath, intervalMs, isDirty, isSaving])
}
