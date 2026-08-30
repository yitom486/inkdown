import { useEffect } from 'react'
import { acpApi } from '@/api/acp-api'
import { acpDevLog } from '@/lib/agent/acp-dev-log'
import { resolveInkdownSnapshot } from '@/lib/agent/context/virtual-fs-resolver'

/**
 * 挂在 App 根：应答主进程对 Inkdown 内存快照的请求。
 * MCP 工具调用与 Agent `fs/read .inkdown/agent/*` 最终都落到这里。
 */
export function AgentSnapshotHost() {
  useEffect(() => {
    return acpApi.onSnapshotRequest((event) => {
      void (async () => {
        try {
          const content = await resolveInkdownSnapshot(event.resource, event.args)
          acpDevLog('snapshot served', { resource: event.resource, chars: content.length })
          acpApi.respondSnapshot({ requestId: event.requestId, ok: true, content })
        } catch (error) {
          acpApi.respondSnapshot({
            requestId: event.requestId,
            ok: false,
            message: error instanceof Error ? error.message : '快照生成失败',
          })
        }
      })()
    })
  }, [])

  return null
}
