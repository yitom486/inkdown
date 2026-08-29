import type { AcpAuthMethod } from '@shared/types/acp'
import type { CodexAuthPreflight } from './codex-auth-preflight'
import { decideConnectAuth } from './connect-auth-decision'

export type ConnectAuthGateResult =
  | { outcome: 'skip_auth' }
  | { outcome: 'needs_auth'; methods: AcpAuthMethod[] }
  | { outcome: 'authenticated'; methodId: string }
  /** 静默认证全失败，但 session/new 仍可用（部分 Agent 允许无显式 authenticate） */
  | { outcome: 'session_without_auth' }

export interface ConnectAuthGateDeps {
  authenticate: (methodId: string) => Promise<void>
  /** 静默认证全失败后的兜底；返回 true 表示已建会话 */
  tryOpenSessionWithoutAuth?: () => Promise<boolean>
}

/**
 * 连接阶段认证门闩（mock Agent + preflight 可测）。
 * 对齐：有 auth.json → 静默；无登录痕迹 → 弹向导。
 */
export async function runConnectAuthGate(
  authMethods: AcpAuthMethod[],
  preflight: Pick<CodexAuthPreflight, 'looksLoggedIn' | 'hasAuthFile' | 'hasApiKeyEnv'>,
  deps: ConnectAuthGateDeps,
): Promise<ConnectAuthGateResult> {
  const decision = decideConnectAuth(authMethods, preflight)

  if (decision.action === 'skip_auth') {
    return { outcome: 'skip_auth' }
  }

  if (decision.action === 'needs_auth') {
    return { outcome: 'needs_auth', methods: decision.methods }
  }

  for (const methodId of decision.methodIds) {
    try {
      await deps.authenticate(methodId)
      return { outcome: 'authenticated', methodId }
    } catch {
      // 尝试下一方式
    }
  }

  if (deps.tryOpenSessionWithoutAuth) {
    try {
      if (await deps.tryOpenSessionWithoutAuth()) {
        return { outcome: 'session_without_auth' }
      }
    } catch {
      // fall through
    }
  }

  return { outcome: 'needs_auth', methods: authMethods }
}
