import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { acpApi } from '@/api/acp-api'

interface PendingPermission {
  requestId: number
  summary: string
  allowId: string
  rejectId?: string
}

/** 挂在 App 根：订阅权限请求并用 Dialog 确认 */
export function AgentPermissionHost() {
  const [pending, setPending] = useState<PendingPermission | null>(null)

  useEffect(() => {
    return acpApi.onPermissionRequest((event) => {
      const options = Array.isArray(event.options) ? event.options : []
      const allowOption = options.find((item) => {
        if (!item || typeof item !== 'object') return false
        const kind = (item as { kind?: string }).kind
        return kind === 'allow_once' || kind === 'allow_always' || kind?.includes('allow')
      })
      const rejectOption = options.find((item) => {
        if (!item || typeof item !== 'object') return false
        const kind = (item as { kind?: string }).kind
        return kind === 'reject_once' || kind === 'reject_always' || kind?.includes('reject')
      })
      const allowId =
        allowOption && typeof allowOption === 'object' && 'optionId' in allowOption
          ? String((allowOption as { optionId: string }).optionId)
          : 'allow-once'
      const rejectId =
        rejectOption && typeof rejectOption === 'object' && 'optionId' in rejectOption
          ? String((rejectOption as { optionId: string }).optionId)
          : undefined

      setPending({
        requestId: event.requestId,
        summary: event.summary ?? 'Agent 请求执行工具',
        allowId,
        rejectId,
      })
    })
  }, [])

  const respond = (allowed: boolean) => {
    if (!pending) return
    const { requestId, allowId, rejectId } = pending
    setPending(null)
    acpApi.respondPermission({
      requestId,
      outcome: allowed
        ? { outcome: 'selected', optionId: allowId }
        : rejectId
          ? { outcome: 'selected', optionId: rejectId }
          : { outcome: 'cancelled' },
    })
  }

  return (
    <Dialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open && pending) respond(false)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>允许工具调用？</DialogTitle>
          <DialogDescription className="whitespace-pre-wrap break-words">
            {pending?.summary}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => respond(false)}>
            拒绝
          </Button>
          <Button type="button" onClick={() => respond(true)}>
            允许
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** @deprecated 使用 AgentPermissionHost 组件 */
export function useAcpPermissionBridge(): void {
  // 保留空实现以免旧调用崩溃；实际 UI 由 AgentPermissionHost 负责
}
