import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { rosettaApi } from '@/api/rosetta-api'
import { isOk } from '@shared/core/result'
import type {
  RosettaBookInfo,
  RosettaImportPhase,
  RosettaImportState,
  RosettaTocEntryInput,
} from '@shared/types/rosetta'

export interface RosettaImportStartArgs {
  filePath: string
  title: string
  format: string
  scale?: number
  /** 总页数（pdf.js 已知，主进程不再为此全量解析一次） */
  pageCount: number
  toc: RosettaTocEntryInput[]
}

/**
 * 罗盘导入视图状态：横幅按钮 + 进度 + 已索引信息。
 * 长任务进度走主进程推送；invoke 结果只做兜底（推送已覆盖全部终态）。
 */
export function useRosettaImport(fileFingerprint: string) {
  const [state, setState] = useState<RosettaImportState>('idle')
  const [phase, setPhase] = useState<RosettaImportPhase>('preparing')
  const [donePages, setDonePages] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [info, setInfo] = useState<RosettaBookInfo | null>(null)
  const startingRef = useRef(false)

  const refreshInfo = useCallback(async () => {
    if (!fileFingerprint) {
      setInfo(null)
      return
    }
    try {
      const result = await rosettaApi.getBookInfo(fileFingerprint)
      setInfo(isOk(result) ? result.value : null)
    } catch {
      setInfo(null)
    }
  }, [fileFingerprint])

  useEffect(() => {
    void refreshInfo()
    if (!fileFingerprint) return
    // 窗口重载时推送已错过：主动拉一次进行中的快照，恢复进度显示
    void rosettaApi.getActiveImport().then((result) => {
      if (!isOk(result) || !result.value || result.value.fingerprint !== fileFingerprint) return
      setState('running')
      setPhase(result.value.phase)
      setDonePages(result.value.donePages)
      setTotalPages(result.value.totalPages)
    })
  }, [refreshInfo, fileFingerprint])

  useEffect(() => {
    if (!fileFingerprint) return
    return rosettaApi.onImportStatus((status) => {
      if (status.fingerprint !== fileFingerprint) return
      setState(status.state)
      setPhase(status.phase ?? 'preparing')
      setDonePages(status.donePages)
      setTotalPages(status.totalPages)
      if (status.state === 'done') {
        toast.success(status.message ? `罗盘索引已就绪：${status.message}` : '罗盘索引已就绪，AI 可直接读库')
        void refreshInfo()
      } else if (status.state === 'error') {
        toast.error(status.message || '罗盘导入失败')
      } else if (status.state === 'cancelled') {
        toast.info('已取消罗盘导入')
      }
    })
  }, [fileFingerprint, refreshInfo])

  const startImport = useCallback(
    (args: RosettaImportStartArgs) => {
      if (!fileFingerprint || startingRef.current || state === 'running') return
      startingRef.current = true
      setState('running')
      setDonePages(0)
      setTotalPages(0)
      void rosettaApi
        .importBook({ fileFingerprint, ...args })
        .catch(() => {
          setState('error')
          toast.error('罗盘导入请求失败')
        })
        .finally(() => {
          startingRef.current = false
        })
    },
    [fileFingerprint, state],
  )

  const cancelImport = useCallback(() => {
    rosettaApi.cancelImport()
  }, [])

  return { state, phase, donePages, totalPages, info, startImport, cancelImport, refreshInfo }
}
