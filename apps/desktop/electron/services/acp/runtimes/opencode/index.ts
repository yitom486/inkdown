import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { AcpAuthMethod, CodexAuthPreflight } from '@inkdown/contracts'
import type { GenericRuntimeAdapter } from '../index'

/**
 * OpenCode 运行时适配器（本机 `opencode acp`）。
 *
 * 凭证复用：`opencode auth login` 写入的 `auth.json`
 *（`$XDG_DATA_HOME/opencode/auth.json`，缺省 `~/.local/share/opencode/auth.json`；
 * Windows 缺省 `%APPDATA%\\opencode\\auth.json`）加环境变量优先透传。
 * 只做布尔级存在性探测，不读密钥内容。
 */
export function resolveOpencodeAuthFile(): string {
  const xdg = process.env.XDG_DATA_HOME?.trim()
  if (xdg) return join(xdg, 'opencode', 'auth.json')
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA?.trim()
    if (appData) return join(appData, 'opencode', 'auth.json')
  }
  return join(homedir(), '.local', 'share', 'opencode', 'auth.json')
}

export function probeOpencodeAuth(): CodexAuthPreflight {
  const authFile = resolveOpencodeAuthFile()
  const authDir = dirname(authFile)
  const hasAuthFile = existsSync(authFile)

  return {
    codexHome: authDir,
    hasCodexHome: existsSync(authDir),
    hasAuthFile,
    hasApiKeyEnv: false,
    looksLoggedIn: hasAuthFile,
  }
}

export const opencodeAdapter: GenericRuntimeAdapter = {
  id: 'opencode',
  probeAuth: () => probeOpencodeAuth(),
  orderAuthMethods: (methods: AcpAuthMethod[]) => methods,
  canSkipInteractiveAuth: () => false,
}
