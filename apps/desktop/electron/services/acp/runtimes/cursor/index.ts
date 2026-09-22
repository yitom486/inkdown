import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
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
 * 预 spawn 接线（`resolveSpawnCommand`，见 `runtimes/index.ts`）：
 * 直接路径与 PATH 均无 CLI 时返回 `null` 表示未安装，
 * 由 `acp-connection.ts` 在 spawn 前判停并返回带安装指引的
 * `ACP_SPAWN_ERROR`，不再把裸 `agent[.cmd]` 丢给 spawn
 *（否则 Windows 上 `cmd` 报“不是内部或外部命令”，子进程秒退，
 * UI 只剩一句看不懂的 `ACP connection closed`）。
 *
 * 凭证复用：本机 Cursor 登录（`agent login`；ACP 侧方法 `cursor_login`）
 * 或 `CURSOR_API_KEY` / `CURSOR_AUTH_TOKEN` 环境透传。
 * 文件探针为 hint 级别（见 probeCursorAuth）：命中→已登录，未命中不下结论，
 * 由 gate 侧 `tryDirectSessionFirst` 兜底直连试一次（keychain 化会漏检）。
 */
export interface CursorPathOverrides {
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  home?: string
}

function cursorLocalAppData(env: NodeJS.ProcessEnv): string {
  const local = env.LOCALAPPDATA?.trim()
  if (local) return local
  const profile = env.USERPROFILE?.trim()
  return profile ? join(profile, 'AppData', 'Local') : ''
}

function isOnPath(command: string, env: NodeJS.ProcessEnv, platform: NodeJS.Platform): boolean {
  const pathValue = env.PATH ?? env.Path ?? ''
  if (!pathValue.trim()) return false
  const sep = platform === 'win32' ? ';' : delimiter
  for (const dir of pathValue.split(sep)) {
    const trimmed = dir.trim().replace(/^"|"$/g, '')
    if (!trimmed) continue
    try {
      if (existsSync(join(trimmed, command))) return true
    } catch {
      // 单个 PATH 条目不可读时跳过，继续找下一条
    }
  }
  return false
}

function resolveDirectCursorCommand(platform: NodeJS.Platform, env: NodeJS.ProcessEnv, home: string): string {
  if (platform === 'win32') {
    const localAppData = cursorLocalAppData(env)
    return localAppData ? join(localAppData, 'cursor-agent', 'agent.cmd') : ''
  }
  return home ? join(home, '.local', 'bin', 'agent') : ''
}

export function resolveCursorCommand(overrides?: CursorPathOverrides): { command: string; args: string[] } {
  const args = ['acp']
  const platform = overrides?.platform ?? process.platform
  const env = overrides?.env ?? process.env
  const home = overrides?.home ?? homedir()
  if (platform === 'win32') {
    const directCmd = resolveDirectCursorCommand(platform, env, home)
    if (directCmd && existsSync(directCmd)) {
      return { command: directCmd, args }
    }
    return { command: 'agent.cmd', args }
  }
  const directBin = resolveDirectCursorCommand(platform, env, home)
  if (directBin && existsSync(directBin)) {
    return { command: directBin, args }
  }
  return { command: 'agent', args }
}

/**
 * 预 spawn 接线点：直接路径命中则透传绝对路径，PATH 命中则透传
 * 裸命令（与 contracts 模板一致），两处皆无返回 `null`（未安装）。
 * `null` 由 `acp-connection.ts` 转为带安装指引的 `ACP_SPAWN_ERROR`。
 */
export function resolveCursorSpawnCommand(
  overrides?: CursorPathOverrides,
): { command: string; args: string[] } | null {
  const args = ['acp']
  const platform = overrides?.platform ?? process.platform
  const env = overrides?.env ?? process.env
  const home = overrides?.home ?? homedir()
  const binary = platform === 'win32' ? 'agent.cmd' : 'agent'
  const direct = resolveDirectCursorCommand(platform, env, home)
  try {
    if (direct && existsSync(direct)) return { command: direct, args }
  } catch {
    // 直接路径不可读时回落 PATH 探测
  }
  if (isOnPath(binary, env, platform)) return { command: binary, args }
  return null
}

/** 未安装时的用户可读指引（分 win/posix 话术），调用方原样透传为 error message。 */
export function buildCursorMissingCliMessage(overrides?: CursorPathOverrides): string {
  const platform = overrides?.platform ?? process.platform
  if (platform === 'win32') {
    return 'Cursor CLI 未安装：请在终端执行 irm https://cursor.com/install?win32=true | iex 后重试（已安装请确认 agent.cmd 在 PATH，或 %LOCALAPPDATA%\\cursor-agent\\agent.cmd 存在）'
  }
  return 'Cursor CLI 未安装：请在终端执行 curl https://cursor.com/install -fsS | bash 后重试（已安装请确认 agent 在 PATH，或 ~/.local/bin/agent 存在）'
}

/**
 * 凭证复用：本机 Cursor 登录（`agent login`）或
 * `CURSOR_API_KEY` / `CURSOR_AUTH_TOKEN` 环境透传。
 *
 * 文件探针（hint 级别，不当 gate）：
 * posix 查 `~/.config/cursor/auth.json`（`$XDG_CONFIG_HOME` 优先）；
 * win 先查 `%USERPROFILE%\.config\cursor\auth.json`（XDG 风格优先，
 * `$XDG_CONFIG_HOME` 优先）再查
 * `%APPDATA%\Cursor\User\globalStorage\storage.json`（旧 App 落盘 hint）。
 * auth.json 命中条件：存在且非空可解析且顶层 accessToken / refreshToken
 * 任一非空；storage.json 命中条件：存在且非空可解析为非空对象（hint 级别）。
 * 教训（Daintree）：新版 token 可能进 OS keychain，文件未命中不断言未登录，
 * 由 gate 侧 tryDirectSessionFirst 兜底直连试一次。
 */
function pickEnv(env: NodeJS.ProcessEnv | undefined, key: string): string {
  return env?.[key]?.trim() ?? ''
}

function cursorRoamingAppData(env: NodeJS.ProcessEnv, home: string): string {
  const roaming = pickEnv(env, 'APPDATA')
  if (roaming) return roaming
  const profile = pickEnv(env, 'USERPROFILE') || home
  return profile ? join(profile, 'AppData', 'Roaming') : ''
}

/** 登录态候选落盘位置（按优先级排序，调用方按序取首个命中）。 */
export function resolveCursorAuthCandidates(overrides?: CursorPathOverrides): string[] {
  const platform = overrides?.platform ?? process.platform
  const env = overrides?.env ?? process.env
  const home = overrides?.home ?? homedir()
  const seen = new Set<string>()
  const out: string[] = []
  const push = (p: string) => {
    if (!p || seen.has(p)) return
    seen.add(p)
    out.push(p)
  }

  const xdg = pickEnv(env, 'XDG_CONFIG_HOME')
  if (xdg) push(join(xdg, 'cursor', 'auth.json'))

  if (platform === 'win32') {
    const profile = pickEnv(env, 'USERPROFILE') || home
    if (profile) push(join(profile, '.config', 'cursor', 'auth.json'))
    const roaming = cursorRoamingAppData(env, home)
    if (roaming) push(join(roaming, 'Cursor', 'User', 'globalStorage', 'storage.json'))
  } else if (home) {
    push(join(home, '.config', 'cursor', 'auth.json'))
  }
  return out
}

function isStorageHintPath(authFile: string): boolean {
  return authFile.replace(/\\/g, '/').endsWith('/globalStorage/storage.json')
}

/** auth.json 有效性：非空可解析且 accessToken / refreshToken 任一非空。 */
export function isValidCursorAuthFile(authFile: string): boolean {
  try {
    if (!authFile || isStorageHintPath(authFile)) return false
    if (!existsSync(authFile)) return false
    const raw = readFileSync(authFile, 'utf8').trim()
    if (!raw) return false
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false
    const row = parsed as Record<string, unknown>
    const access = typeof row.accessToken === 'string' ? row.accessToken.trim() : ''
    const refresh = typeof row.refreshToken === 'string' ? row.refreshToken.trim() : ''
    return Boolean(access || refresh)
  } catch {
    return false
  }
}

/** storage.json hint 级别有效性：存在且非空可解析为非空对象即算命中。 */
export function isHintCursorStorageFile(authFile: string): boolean {
  try {
    if (!authFile || !isStorageHintPath(authFile)) return false
    if (!existsSync(authFile)) return false
    const raw = readFileSync(authFile, 'utf8').trim()
    if (!raw) return false
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false
    return Object.keys(parsed).length > 0
  } catch {
    return false
  }
}

function isValidCursorCandidate(authFile: string): boolean {
  return isStorageHintPath(authFile)
    ? isHintCursorStorageFile(authFile)
    : isValidCursorAuthFile(authFile)
}

export function probeCursorAuth(overrides?: CursorPathOverrides): CodexAuthPreflight {
  const env = overrides?.env ?? process.env
  const home = overrides?.home ?? homedir()
  const hasApiKeyEnv = Boolean(
    env.CURSOR_API_KEY?.trim() || env.CURSOR_AUTH_TOKEN?.trim(),
  )

  const candidates = resolveCursorAuthCandidates(overrides)
  let firstExisting: string | null = null
  let validFile: string | null = null
  for (const candidate of candidates) {
    let exists = false
    try {
      exists = existsSync(candidate)
    } catch {
      exists = false
    }
    if (!exists) continue
    firstExisting ??= candidate
    if (validFile) continue
    if (isValidCursorCandidate(candidate)) validFile = candidate
  }

  const fallback = home ? join(home, '.config', 'cursor', 'auth.json') : ''
  const authFile = validFile ?? firstExisting ?? candidates[0] ?? fallback
  const authDir = authFile ? dirname(authFile) : ''
  let hasCodexHome = false
  try {
    hasCodexHome = authDir ? existsSync(authDir) : false
  } catch {
    hasCodexHome = false
  }

  return {
    codexHome: authDir,
    hasCodexHome,
    hasAuthFile: firstExisting !== null,
    hasApiKeyEnv,
    looksLoggedIn: validFile !== null || hasApiKeyEnv,
  }
}

export const cursorAdapter: GenericRuntimeAdapter = {
  id: 'cursor-cli',
  probeAuth: () => probeCursorAuth(),
  resolveSpawnCommand: () => resolveCursorSpawnCommand(),
  orderAuthMethods: (methods: AcpAuthMethod[]) => methods,
  canSkipInteractiveAuth: () => false,
  // keychain 化凭据文件探针会漏检，未命中时由 gate 直连试一次兜底
  tryDirectSessionFirst: true,
}
