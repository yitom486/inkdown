import type { AcpAuthMethod, AcpProxySettings, CodexAuthPreflight } from '@inkdown/contracts'
import {
  bridgeAntigravityCredentialFromManager,
  hasValidAntigravityTokenFile,
} from './antigravity-bridge'
import {
  antigravityCredentialsPresent,
  getAntigravityConfiguredAuthType,
  probeAntigravityAuth,
} from './antigravity-auth'
import { buildAntigravityProxyEnv } from './antigravity-proxy'
import { findAntigravityServer } from './antigravity-discovery'
import { sweepStaleAntigravityTempDirs } from './antigravity-temp-sweep'

export * from './antigravity-bridge'
export * from './antigravity-auth'
export * from './antigravity-proxy'
export * from './antigravity-discovery'
export * from './antigravity-temp-sweep'

export interface AntigravityRuntimeAdapter {
  id: 'antigravity-acp'
  findServer: typeof findAntigravityServer
  beforeSpawn: () => Promise<void>
  /** 仅冷启动时调用一次：收拾已死进程的 _MEI/.tmp 残留 */
  onColdStart: () => Promise<void>
  getSpawnEnv: (proxySettings?: Partial<AcpProxySettings>) => {
    env: NodeJS.ProcessEnv
    envRemove: string[]
  }
  probeAuth: () => CodexAuthPreflight
  orderAuthMethods: (methods: AcpAuthMethod[]) => AcpAuthMethod[]
  canSkipInteractiveAuth: (methodId: string, force?: boolean) => boolean
}

export const antigravityAdapter: AntigravityRuntimeAdapter = {
  id: 'antigravity-acp',
  findServer: findAntigravityServer,

  /** 进程启动前钩子：检测到 Token 缺失时自动从 Windows 凭据管理器执行桥接 */
  beforeSpawn: async () => {
    await bridgeAntigravityCredentialFromManager()
  },

  /**
   * 冷启动前钩子：清扫已死进程的 _MEI/.tmp 残留。
   * 温进程与 Zed 共存实例的目录因新鲜（或被 DLL 锁占用）会被豁免；失败不阻塞连接。
   */
  onColdStart: async () => {
    try {
      await sweepStaleAntigravityTempDirs()
    } catch {
      // 清扫失败不阻塞连接
    }
  },

  /** 专享代理：全量注入 SOCKS5 与 HTTP 代理及 NO_PROXY */
  getSpawnEnv: (proxySettings) => {
    return buildAntigravityProxyEnv(proxySettings)
  },

  /** 凭据探测 */
  probeAuth: () => {
    return probeAntigravityAuth()
  },

  /** 根据 settings.json 中的 auth.type 精准排序置顶 */
  orderAuthMethods: (methods) => {
    const configured = getAntigravityConfiguredAuthType()
    if (!configured) return methods
    return [...methods].sort((a, b) => {
      if (a.id === configured) return -1
      if (b.id === configured) return 1
      return 0
    })
  },

  /**
   * 认证守门员逻辑（依据 docs/antigravity_acp_auth_and_lifecycle.md 第 3.4 节）：
   * 官方 ACP 收到 authenticate 请求时无脑拉起系统浏览器；
   * 若本地已拥有有效 Token 且非强制重登，客户端直接判定就绪，杜绝弹窗打扰。
   */
  canSkipInteractiveAuth: (methodId, force = false) => {
    if (force) return false
    if (methodId === 'oauth-personal') {
      return hasValidAntigravityTokenFile() || antigravityCredentialsPresent()
    }
    return false
  },
}
