import type { AcpChatMessage } from '@/stores/acp-chat-types'
import type { AcpPendingPermission } from '@/stores/acp-ui-store'

/** 工具卡是否应展示内联审批按钮 */
export function toolMessageNeedsApproval(
  message: Pick<AcpChatMessage, 'role' | 'toolCallId'>,
  pending: AcpPendingPermission | null,
): boolean {
  if (!pending?.toolCallId) return false
  if (message.role !== 'tool') return false
  return Boolean(message.toolCallId) && message.toolCallId === pending.toolCallId
}

/**
 * 权限请求尚未对应到时间线工具卡时，在对话流底部单独浮出审批卡。
 */
export function shouldShowOrphanPermissionCard(
  pending: AcpPendingPermission | null,
  messages: Array<Pick<AcpChatMessage, 'role' | 'toolCallId'>>,
): boolean {
  if (!pending) return false
  if (!pending.toolCallId) return true
  return !messages.some(
    (m) => m.role === 'tool' && m.toolCallId === pending.toolCallId,
  )
}
