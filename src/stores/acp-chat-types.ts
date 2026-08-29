import type { AcpToolCallKind, AcpToolCallStatus } from '@shared/types/acp'

export type AcpChatRole = 'user' | 'agent' | 'thought' | 'tool' | 'system'

export interface AcpChatMessage {
  id: string
  role: AcpChatRole
  text: string
  streaming?: boolean
  /** tool 卡片字段 */
  toolCallId?: string
  toolKind?: AcpToolCallKind | string
  toolStatus?: AcpToolCallStatus | string
  toolTitle?: string
  toolContentText?: string
  toolLocations?: Array<{ path: string; line?: number }>
}

export function extractTextFromContent(content: unknown): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (typeof content === 'object' && content !== null) {
    const row = content as Record<string, unknown>
    if (typeof row.text === 'string') return row.text
    if (row.content) return extractTextFromContent(row.content)
  }
  return ''
}

/** 把 ACP tool content[] 压成可读摘要（卡片展开区） */
export function flattenToolContent(content: unknown): string {
  if (!Array.isArray(content)) {
    const single = extractTextFromContent(content)
    return single
  }

  const parts: string[] = []
  for (const item of content) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const type = typeof row.type === 'string' ? row.type : ''

    if (type === 'diff') {
      const path = typeof row.path === 'string' ? row.path : 'file'
      const oldText = typeof row.oldText === 'string' ? row.oldText : ''
      const newText = typeof row.newText === 'string' ? row.newText : ''
      const oldLines = oldText ? oldText.split('\n').length : 0
      const newLines = newText ? newText.split('\n').length : 0
      parts.push(`${path}  (~${oldLines} → ~${newLines} 行)`)
      continue
    }

    if (type === 'terminal') {
      parts.push(`终端 ${typeof row.terminalId === 'string' ? row.terminalId : ''}`.trim())
      continue
    }

    if (type === 'content' || row.content) {
      const text = extractTextFromContent(row.content ?? row)
      if (text) parts.push(text)
      continue
    }

    const text = extractTextFromContent(row)
    if (text) parts.push(text)
  }

  return parts.filter(Boolean).join('\n\n')
}

export function parseToolLocations(
  locations: unknown,
): Array<{ path: string; line?: number }> | undefined {
  if (!Array.isArray(locations)) return undefined
  const rows: Array<{ path: string; line?: number }> = []
  for (const item of locations) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    if (typeof row.path !== 'string' || !row.path) continue
    rows.push({
      path: row.path,
      line: typeof row.line === 'number' ? row.line : undefined,
    })
  }
  return rows.length > 0 ? rows : undefined
}

export function isToolActiveStatus(status: string | undefined): boolean {
  return status === 'pending' || status === 'in_progress' || !status
}
