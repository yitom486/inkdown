import type { AcpAuthMethod, AcpProxySettings, CodexAuthPreflight } from '@inkdown/contracts'
import { DEFAULT_ACP_RUNTIME_ID } from '@inkdown/contracts'
import { codexAdapter } from './codex'
import { emptyAcpAuthPreflight } from './codex/codex-auth-preflight'

export * from './codex'

export interface GenericRuntimeAdapter {
  id: string
  beforeSpawn?: () => Promise<void>
  /** 仅冷启动（无温进程可用、即将 spawn）时调用一次；各 runtime 自理副作用 */
  onColdStart?: () => Promise<void>
  probeAuth: () => CodexAuthPreflight
  getSpawnEnv?: (proxySettings?: Partial<AcpProxySettings>) => {
    env: NodeJS.ProcessEnv
    envRemove: string[]
  }
  orderAuthMethods?: (methods: AcpAuthMethod[]) => AcpAuthMethod[]
  canSkipInteractiveAuth?: (methodId: string, force?: boolean) => boolean
}

export type AcpRuntimeAdapter = GenericRuntimeAdapter & {
  getCustomProvider?: typeof codexAdapter.getCustomProvider
}

export function getAcpRuntimeAdapter(runtimeId: string): AcpRuntimeAdapter {
  if (runtimeId === DEFAULT_ACP_RUNTIME_ID) {
    return codexAdapter
  }
  return {
    id: runtimeId,
    probeAuth: emptyAcpAuthPreflight,
  }
}
