import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AcpAuthMethod, CodexAuthPreflight } from '@inkdown/contracts'
import type { GenericRuntimeAdapter } from '../index'

/**
 * Cursor 运行时适配器（Cursor 官方 CLI `agent acp`，运行时 id `cursor-cli`）。
 *
 * 安装路径探测（我方实现，对标官方安装位置，不拷贝第三方网关代码）：
 * Windows 优先 `%LOCALAPPDATA%\\cursor-agent\\agent.cmd`（存在才用），
 * posix 优先 `~/.local/bin/agent`（存在才用），否则回落 PATH 中的
 * `agent.cmd`（win）/ `agent`（posix），与 contracts 模板 fallback 一致。
 *
 * 凭证复用：本机 Cursor 登录（`agent login`；ACP 侧方法 `cursor_login`）
 * 或 `CURSOR_API_KEY` / `CURSOR_AUTH_TOKEN` 环境透传。
 * CLI 登录态落盘位置官方未稳定承诺，文件侧不做断言：
 * 无 token 环境变量时一律按未登录处理，走协议 authMethods 向导（保守）。
 */
export function resolveCursorCommand(): { command: string; args: string[] } {
  const args = ['acp']
  if (process.platform === 'win32') {
    const localAppData =
      process.env.LOCALAPPDATA?.trim() ||
      (process.env.USERPROFILE?.trim() ? `${process.env.USERPROFILE}\\AppData\\Local` : '')
    const directCmd = localAppData ? join(localAppData, 'cursor-agent', 'agent.cmd') : ''
    if (directCmd && existsSync(directCmd)) {
      return { command: directCmd, args }
    }
    return { command: 'agent.cmd', args }
  }
  const home = homedir()
  const directBin = home ? join(home, '.local', 'bin', 'agent') : ''
  if (directBin && existsSync(directBin)) {
    return { command: directBin, args }
  }
  return { command: 'agent', args }
}

export function probeCursorAuth(): CodexAuthPreflight {
  const hasApiKeyEnv = Boolean(
    process.env.CURSOR_API_KEY?.trim() || process.env.CURSOR_AUTH_TOKEN?.trim(),
  )

  return {
    codexHome: '',
    hasCodexHome: false,
    hasAuthFile: false,
    hasApiKeyEnv,
    looksLoggedIn: hasApiKeyEnv,
  }
}

export const cursorAdapter: GenericRuntimeAdapter = {
  id: 'cursor-cli',
  probeAuth: () => probeCursorAuth(),
  orderAuthMethods: (methods: AcpAuthMethod[]) => methods,
  canSkipInteractiveAuth: () => false,
}
