import type { AcpAuthMethod, CodexAuthPreflight } from '@inkdown/contracts'
import type { GenericRuntimeAdapter } from '../index'

/**
 * DeepSeek 运行时适配器（`bunx @deepseek-ai/dsh --profile acp`）。
 *
 * 凭证复用：harness 自身凭证（`DEEPSEEK_API_KEY` / harness 配置，
 * 全部留在官方位置，我方不存）。harness 的 ACP `authMethods` 为空，
 * 连接门闩天然走 `skip_auth`；此处探测仅供诊断展示。
 */
export function probeDeepseekAuth(): CodexAuthPreflight {
  const hasApiKeyEnv = Boolean(process.env.DEEPSEEK_API_KEY?.trim())

  return {
    codexHome: '',
    hasCodexHome: false,
    hasAuthFile: false,
    hasApiKeyEnv,
    looksLoggedIn: hasApiKeyEnv,
  }
}

export const deepseekAdapter: GenericRuntimeAdapter = {
  id: 'deepseek',
  probeAuth: () => probeDeepseekAuth(),
  orderAuthMethods: (methods: AcpAuthMethod[]) => methods,
  canSkipInteractiveAuth: () => false,
}
