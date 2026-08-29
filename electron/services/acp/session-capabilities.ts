/** 从 initialize 的 agentCapabilities 解析会话恢复能力 */

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
