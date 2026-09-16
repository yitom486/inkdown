import { useEffect, useRef } from 'react'
import { syncApi } from '@/api/sync-api'
import { useReadingProgressStore } from '@/stores/reading-progress-store'

/**
 * 桥接渲染端 Zustand 阅读进度与主进程云同步存储
 * 1. 挂载时监听主进程下发的远端更新并热载入
 * 2. 状态变动时 debounce 2秒同步给主进程持久化
 */
export function useSyncProgressBridge(): void {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // 1. 监听主进程广播的远端合并进度并合入本地 Zustand
    const unsubscribeRemote = syncApi.onApplyRemoteProgress((progressJson) => {
      try {
        const snapshot = JSON.parse(progressJson)
        useReadingProgressStore.getState().importProgressSnapshot(snapshot)
      } catch {}
    })

    // 2. 挂载时立即把本地进度快照推一次给主进程
    const initialSnapshot = useReadingProgressStore.getState().exportProgressSnapshot()
    void syncApi.saveLocalProgress(JSON.stringify(initialSnapshot))

    // 3. 监听本地 Store 变动，节流推送到主进程
    const unsubscribeStore = useReadingProgressStore.subscribe((state) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      debounceTimerRef.current = setTimeout(() => {
        const snapshot = {
          epubByFile: state.epubByFile,
          mobiByFile: state.mobiByFile,
          pdfByFile: state.pdfByFile,
          webByUrl: state.webByUrl,
        }
        void syncApi.saveLocalProgress(JSON.stringify(snapshot))
      }, 2000)
    })

    return () => {
      unsubscribeRemote()
      unsubscribeStore()
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])
}
