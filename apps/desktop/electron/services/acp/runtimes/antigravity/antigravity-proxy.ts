import type { AcpProxySettings } from '@inkdown/contracts'

/**
 * 针对 Antigravity 运行时的专属代理环境变量：
 * 仅作用于 Antigravity（Google ACP 服务端，国内访问 Google 凭据服务必需）；
 * 端口默认 7897（或配置中的 port）；
 * 优先继承外部环境变量，回落到默认代理；
 * 完整注入大小写 HTTP_PROXY, HTTPS_PROXY, ALL_PROXY(socks5), NO_PROXY("localhost,127.0.0.1,::1")。
 */
export function buildAntigravityProxyEnv(settings?: Partial<AcpProxySettings>): {
  env: NodeJS.ProcessEnv
  envRemove: string[]
} {
  const host = settings?.host?.trim() || '127.0.0.1'
  const port =
    typeof settings?.port === 'number' &&
    Number.isInteger(settings.port) &&
    settings.port >= 1 &&
    settings.port <= 65535
      ? settings.port
      : 7897

  const defaultProxy = `http://${host}:${port}`
  const defaultSocksProxy = `socks5://${host}:${port}`

  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy || defaultProxy
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy || defaultProxy
  const allProxy = process.env.ALL_PROXY || process.env.all_proxy || defaultSocksProxy
  const noProxy = 'localhost,127.0.0.1,::1'

  return {
    env: {
      HTTP_PROXY: httpProxy,
      HTTPS_PROXY: httpsProxy,
      http_proxy: httpProxy,
      https_proxy: httpsProxy,
      ALL_PROXY: allProxy,
      all_proxy: allProxy,
      NO_PROXY: noProxy,
      no_proxy: noProxy,
    },
    envRemove: [],
  }
}
