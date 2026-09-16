import { useEffect } from 'react'
import { acpApi } from '@/api/acp-api'
import {
  parsePermissionOptions,
  permissionSummaryFromToolCall,
  toolCallIdFromPermission,
} from '@/lib/agent/acp-permission'
import { useAcpUiStore } from '@/stores/acp-ui-store'

/**
 * 挂在 App 根：订阅 ACP 权限请求，写入 store，供聊天内联审批卡使用。
 * （不再用全局 Dialog 作为主路径——用户期望按钮出现在气泡/工具卡上。）
 */
export function AgentPermissionHost() {
  const ingestPermissionRequest = useAcpUiStore((s) => s.ingestPermissionRequest)
  const clearPendingPermission = useAcpUiStore((s) => s.clearPendingPermission)

  useEffect(() => {
    return acpApi.onPermissionRequest((event) => {
      const toolCall =
        event.toolCall && typeof event.toolCall === 'object'
          ? event.toolCall
          : undefined
      const options = parsePermissionOptions(event.options)
      console.info('[acp-ui] 收到权限请求 IPC', {
        requestId: event.requestId,
        summary: event.summary,
        toolCallId: toolCallIdFromPermission(toolCall),
        optionCount: options.length,
      })
      ingestPermissionRequest({
        requestId: event.requestId,
        sessionId: event.sessionId,
        toolCallId: toolCallIdFromPermission(toolCall),
        summary:
          event.summary ??
          permissionSummaryFromToolCall(toolCall, 'Agent 请求执行工具'),
        options,
        toolCall,
      })
    })
  }, [clearPendingPermission, ingestPermissionRequest])

  useEffect(() => {
    return acpApi.onStatusChanged((event) => {
      if (event.status === 'disconnected' || event.status === 'error') {
        clearPendingPermission()
      }
    })
  }, [clearPendingPermission])

  return null
}

/** @deprecated 使用 AgentPermissionHost 组件 */
export function useAcpPermissionBridge(): void {
  // 保留空实现以免旧调用崩溃；实际由 AgentPermissionHost 负责
}
