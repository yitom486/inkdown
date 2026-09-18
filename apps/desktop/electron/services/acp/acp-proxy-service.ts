import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { AcpProxySettings, AppError } from '@inkdown/contracts'
import { err, ok, type Result } from '@inkdown/contracts'

/**
 * ACP 子进程代理设置：读写 userData/agent/proxy.json。
 * 仅影响 spawn 的 Agent 进程（HTTP_PROXY 等环境变量），应用自身网络不受影响。
 */
export const DEFAULT_ACP_PROXY_SETTINGS: AcpProxySettings = {
  enabled: false,
  host: '127.0.0.1',
  port: 7897,
}

const PROXY_ENV_KEYS = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY'] as const
const LOWERCASE_PROXY_ENV_KEYS = ['http_proxy', 'https_proxy', 'all_proxy', 'no_proxy'] as const

function proxyFilePath(dir: string): string {
  return join(dir, 'agent', 'proxy.json')
}

function validate(settings: AcpProxySettings): string | null {
  if (!settings.host.trim()) return '代理主机不能为空'
  if (
    !Number.isInteger(settings.port) ||
    settings.port < 1 ||
    settings.port > 65535
  ) {
    return '代理端口必须是 1-65535 的整数'
  }
  return null
}

/** 文件缺失/损坏回落默认值（enabled=false 保证未知状态直连） */
export async function readAcpProxySettings(
  dir = app.getPath('userData'),
): Promise<AcpProxySettings> {
  const file = proxyFilePath(dir)
  if (!existsSync(file)) return { ...DEFAULT_ACP_PROXY_SETTINGS }
  try {
    const raw = JSON.parse(await readFile(file, 'utf8')) as Partial<AcpProxySettings>
    return {
      enabled: raw.enabled === true,
      host: typeof raw.host === 'string' && raw.host.trim() ? raw.host : DEFAULT_ACP_PROXY_SETTINGS.host,
      port:
        typeof raw.port === 'number' && Number.isInteger(raw.port) && raw.port >= 1 && raw.port <= 65535
          ? raw.port
          : DEFAULT_ACP_PROXY_SETTINGS.port,
    }
  } catch {
    return { ...DEFAULT_ACP_PROXY_SETTINGS }
  }
}

export async function saveAcpProxySettings(
  payload: AcpProxySettings,
  dir = app.getPath('userData'),
): Promise<Result<AcpProxySettings, AppError>> {
  const invalid = validate(payload)
  if (invalid) return err({ code: 'INVALID_ARGUMENT', message: invalid })
  const stored: AcpProxySettings = {
    enabled: payload.enabled === true,
    host: payload.host.trim() || DEFAULT_ACP_PROXY_SETTINGS.host,
    port: payload.port,
  }
  await mkdir(join(dir, 'agent'), { recursive: true })
  await writeFile(proxyFilePath(dir), JSON.stringify(stored, null, 2), 'utf8')
  return ok(stored)
}

export function buildAcpProxySpawnEnv(settings: AcpProxySettings): {
  env: NodeJS.ProcessEnv
  envRemove: string[]
} {
  if (!settings.enabled) {
    return {
      env: {},
      envRemove: [...PROXY_ENV_KEYS, ...LOWERCASE_PROXY_ENV_KEYS],
    }
  }
  const url = `http://${settings.host.trim()}:${settings.port}`
  return {
    env: {
      HTTP_PROXY: url,
      HTTPS_PROXY: url,
      ALL_PROXY: url,
      NO_PROXY: 'localhost,127.0.0.1',
    },
    envRemove: [...LOWERCASE_PROXY_ENV_KEYS],
  }
}

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

