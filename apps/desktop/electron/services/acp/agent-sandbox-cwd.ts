import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

export type AgentCwdSource = 'workspace' | 'sandbox'

export interface ResolvedAgentCwd {
  cwd: string
  source: AgentCwdSource
}

/** 无用户工作区时 ACP session/new 使用的沙箱目录（仅满足协议 cwd，非用户文档树）。 */
export function ensureAgentSandboxCwd(): string {
  const dir = join(app.getPath('userData'), 'agent-sandbox')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function resolveAgentCwd(preferred?: string | null): ResolvedAgentCwd {
  const trimmed = preferred?.trim()
  if (trimmed) {
    // 剥离 Windows 扩展路径前缀 \\?\，避免进入 Go 编写的 agy_acp_server 导致 file://%3F/ panic
    const normalized = trimmed.replace(/^\\\\\?\\/, '')
    return { cwd: normalized, source: 'workspace' }
  }
  return { cwd: ensureAgentSandboxCwd().replace(/^\\\\\?\\/, ''), source: 'sandbox' }
}

