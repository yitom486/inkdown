import { useEffect } from 'react'
import { acpApi } from '@/api/acp-api'

/**
 * 阶段 B 临时权限 UI：用 confirm 代替 shadcn Dialog（阶段 C 再换）。
 * 挂在 App 根即可。
 */
export function useAcpPermissionBridge(): void {
  useEffect(() => {
    return acpApi.onPermissionRequest((event) => {
      const summary = event.summary ?? 'Agent 请求执行工具'
      const allowed = window.confirm(`${summary}\n\n是否允许？`)
      const allowOption = Array.isArray(event.options)
        ? event.options.find((item) => {
            if (!item || typeof item !== 'object') return false
            const kind = (item as { kind?: string }).kind
            return kind === 'allow_once' || kind === 'allow_always' || kind?.includes('allow')
          })
        : undefined
      const allowId =
        allowOption && typeof allowOption === 'object' && 'optionId' in allowOption
          ? String((allowOption as { optionId: string }).optionId)
          : 'allow-once'

      acpApi.respondPermission({
        requestId: event.requestId,
        outcome: allowed
          ? { outcome: 'selected', optionId: allowId }
          : { outcome: 'cancelled' },
      })
    })
  }, [])
}
