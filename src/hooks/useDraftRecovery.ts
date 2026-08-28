import { useEffect, useRef, useState } from 'react'
import { getDraftKey, pickLatestRecoverableDraft } from '@/lib/draft-utils'
import { useDraftStore } from '@/stores/draft-store'

/** 应用启动时检测本地草稿，返回待恢复的 draft key */
export function useDraftRecoveryPrompt() {
  const [recoveryDraftKey, setRecoveryDraftKey] = useState<string | null>(null)
  const checkedRef = useRef(false)

  useEffect(() => {
    if (checkedRef.current) return
    checkedRef.current = true

    const { drafts } = useDraftStore.getState()
    const latest = pickLatestRecoverableDraft(drafts)
    if (latest) {
      setRecoveryDraftKey(getDraftKey(latest.filePath))
    }
  }, [])

  const dismissRecovery = () => setRecoveryDraftKey(null)

  return { recoveryDraftKey, dismissRecovery }
}

export { useDraftPersistence, clearDraftForFile } from '@/hooks/useDraftPersistence'
