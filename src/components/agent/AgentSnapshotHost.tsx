import { useEffect } from 'react'
import { acpApi } from '@/api/acp-api'
import { acpDevLog } from '@/lib/acp-dev-log'
import { resolveInkdownVirtualResource } from '@/lib/agent-context/virtual-fs-resolver'

/**
 * 挂在 App 根：应答主进程对 Inkdown 虚拟文件的快照请求。
 * Agent `fs/read .inkdown/agent/*` 最终落到这里，从内存直接序列化。
 */
export function AgentSnapshotHost() {
  useEffect(() => {
    return acpApi.onSnapshotRequest((event) => {
      try {
        const content = resolveInkdownVirtualResource(event.resource)
        acpDevLog('snapshot served', { resource: event.resource, chars: content.length })
        acpApi.respondSnapshot({ requestId: event.requestId, ok: true, content })
      } catch (error) {
        acpApi.respondSnapshot({
          requestId: event.requestId,
          ok: false,
          message: error instanceof Error ? error.message : '快照生成失败',
        })
      }
    })
  }, [])

  return null
}
