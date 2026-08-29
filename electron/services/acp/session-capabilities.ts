/** 从 initialize 的 agentCapabilities 解析会话恢复与 prompt 能力 */

import type { AcpPromptCapabilities } from '@shared/types/acp'

export function parseLoadSessionSupported(caps: Record<string, unknown>): boolean {
  return caps.loadSession === true
}

/**
 * ACP：`sessionCapabilities.resume` 可为 `true` 或非空对象（codex-acp 用 `{}`）。
 */
export function parseResumeSessionSupported(caps: Record<string, unknown>): boolean {
  const sessionCaps =
    caps.sessionCapabilities && typeof caps.sessionCapabilities === 'object'
      ? (caps.sessionCapabilities as Record<string, unknown>)
      : null
  if (!sessionCaps) return false
  const resume = sessionCaps.resume
  if (resume === true) return true
  if (resume && typeof resume === 'object') return true
  return false
}

export function parsePromptCapabilities(caps: Record<string, unknown>): AcpPromptCapabilities {
  const raw =
    caps.promptCapabilities && typeof caps.promptCapabilities === 'object'
      ? (caps.promptCapabilities as Record<string, unknown>)
      : null
  if (!raw) return {}
  return {
    image: raw.image === true,
    audio: raw.audio === true,
    embeddedContext: raw.embeddedContext === true,
  }
}
