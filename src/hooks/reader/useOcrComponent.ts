import { useCallback, useEffect, useState } from 'react'
import {
  cancelOcrComponentDownload,
  ensureOcrComponent,
  getOcrComponentStatus,
  onOcrComponentStatus,
} from '@/api/ocr-api'
import type { OcrComponentStatus } from '@shared/types/ocr'

const DEFAULT_STATUS: OcrComponentStatus = {
  phase: 'not-ready',
  progress: 0,
  runtimeReady: false,
  languages: [],
  missingLanguages: ['chi_sim', 'eng'],
}

export function useOcrComponent(enabled = true) {
  const [status, setStatus] = useState<OcrComponentStatus>(DEFAULT_STATUS)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    const result = await getOcrComponentStatus()
    if (result.ok) {
      setStatus(result.value)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    const unsubscribe = onOcrComponentStatus((next) => setStatus(next))
    return unsubscribe
  }, [enabled, refresh])

  const download = useCallback(async () => {
    setLoading(true)
    try {
      const result = await ensureOcrComponent()
      if (!result.ok && result.error.code !== 'CANCELLED') {
        return result
      }
      return result
    } finally {
      setLoading(false)
    }
  }, [])

  const cancel = useCallback(async () => {
    const result = await cancelOcrComponentDownload()
    if (result.ok) {
      setStatus(result.value)
    }
  }, [])

  return {
    status,
    loading,
    refresh,
    download,
    cancel,
  }
}
