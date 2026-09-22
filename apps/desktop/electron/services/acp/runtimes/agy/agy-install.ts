import { spawnSync } from 'node:child_process'
import { existsSync as defaultExistsSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { app } from 'electron'
import { AGY_ACP_NPM_PACKAGE } from '@inkdown/contracts'

export const AGY_MANAGED_EXE_REL = 'dist/agy-acp-win-x64.exe'

export interface AgyInstallOverrides {
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  /** 测试注入：覆盖 app.getPath('userData') */
  userDataDir?: string
  home?: string
  spawn?: typeof spawnSync
  /** 测试注入：覆盖文件存在性判定（默认 existsSync） */
  exists?: (p: string) => boolean
}

function existsUnder(overrides: AgyInstallOverrides | undefined, p: string): boolean {
  try {
    return (overrides?.exists ?? defaultExistsSync)(p)
  } catch {
    return false
  }
}

/** managed 根：userData/agents/agy（测试可经 userDataDir 覆盖）。 */
export function resolveAgyManagedDir(overrides?: AgyInstallOverrides): string {
  if (overrides?.userDataDir) return join(overrides.userDataDir, 'agents', 'agy')
  try {
    return join(app.getPath('userData'), 'agents', 'agy')
  } catch {
    const home = overrides?.home ?? homedir()
    return join(home, '.inkdown', 'agents', 'agy')
  }
}

export function resolveAgyPkgDir(overrides?: AgyInstallOverrides): string {
  return join(resolveAgyManagedDir(overrides), 'node_modules', AGY_ACP_NPM_PACKAGE)
}

export function resolveAgyExePath(overrides?: AgyInstallOverrides): string {
  return join(resolveAgyPkgDir(overrides), AGY_MANAGED_EXE_REL)
}

function readInstalledAgyVersion(pkgDir: string): string | null {
  try {
    const raw = readFileSync(join(pkgDir, 'package.json'), 'utf8')
    const parsed = JSON.parse(raw) as { version?: unknown }
    return typeof parsed.version === 'string' && parsed.version ? parsed.version : null
  } catch {
    return null
  }
}

/** npm 探测：win 取 npm.cmd，posix 取 npm；缺失返回 null（调用方报中文友好错）。 */
export function resolveAgyNpmBin(overrides?: AgyInstallOverrides): string | null {
  const platform = overrides?.platform ?? process.platform
  const env = overrides?.env ?? process.env
  const wanted = platform === 'win32' ? 'npm.cmd' : 'npm'
  const pathValue = env.PATH ?? env.Path ?? ''
  if (!pathValue.trim()) return null
  for (const dir of pathValue.split(delimiter)) {
    const trimmed = dir.trim().replace(/^"|"$/g, '')
    if (!trimmed) continue
    const full = join(trimmed, wanted)
    try {
      if (defaultExistsSync(full)) return full
    } catch {
      continue
    }
  }
  return null
}

export function buildAgyMissingNpmMessage(): string {
  return '找不到 npm（不在 PATH 中）：请先安装 Node.js 20+ 后再连接 agy'
}

export interface AgyNpmInvocation {
  file: string
  args: string[]
  shell: boolean
}

/**
 * npm 调用形态（Windows EINVAL 根因修复）：
 * `npm.cmd` 不能直接 spawn（无 shell 即 EINVAL，尤其路径含空格时），
 * 优先同目录 `node.exe + npm-cli.js`（免 shell，零引号坑）；
 * 找不到才回落 `shell: true` 起 npm.cmd。
 */
export function resolveAgyNpmInvocation(
  npm: string,
  args: string[],
  overrides?: AgyInstallOverrides,
): AgyNpmInvocation {
  const platform = overrides?.platform ?? process.platform
  if (platform === 'win32' && /npm\.cmd$/i.test(npm)) {
    const dir = dirname(npm)
    const nodeExe = join(dir, 'node.exe')
    const cliJs = join(dir, 'node_modules', 'npm', 'bin', 'npm-cli.js')
    if (existsUnder(overrides, nodeExe) && existsUnder(overrides, cliJs)) {
      // 自证版本：这行出现即证明运行的是 EINVAL 修复后的新 main
      if (process.env.NODE_ENV !== 'production') {
        console.info('[acp:agy] npm invocation: node-direct (EINVAL fixed)')
      }
      return { file: nodeExe, args: [cliJs, ...args], shell: false }
    }
    if (process.env.NODE_ENV !== 'production') {
      console.info('[acp:agy] npm invocation: shell-fallback (no node runtime beside npm.cmd)')
    }
    return { file: npm, args, shell: true }
  }
  return { file: npm, args, shell: false }
}

/** 数字比对：1 => a 更新，-1 => b 更新，0 => 相等/未知。 */
export function compareAgyVersions(a: string, b: string): number {
  const pa = a.split('.').map((x) => parseInt(x, 10))
  const pb = b.split('.').map((x) => parseInt(x, 10))
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (Number.isNaN(na) || Number.isNaN(nb)) continue
    if (na !== nb) return na > nb ? 1 : -1
  }
  return 0
}

/** registry 最新版：`npm view <pkg> version`，20s 超时；失败返回 null。 */
export function latestAgyVersion(
  overrides?: AgyInstallOverrides,
  timeoutMs = 20_000,
): string | null {
  const npm = resolveAgyNpmBin(overrides)
  if (!npm) return null
  const spawn = overrides?.spawn ?? spawnSync
  const inv = resolveAgyNpmInvocation(npm, ['view', AGY_ACP_NPM_PACKAGE, 'version'], overrides)
  try {
    const result = spawn(inv.file, inv.args, {
      encoding: 'utf8',
      timeout: timeoutMs,
      windowsHide: true,
      shell: inv.shell,
    })
    if (result.error || result.status !== 0) return null
    const version = String(result.stdout ?? '')
      .trim()
      .split(/\s+/)
      .pop() ?? ''
    return /^[0-9][0-9A-Za-z.\-+]*$/.test(version) ? version : null
  } catch {
    return null
  }
}

export interface EnsureAgyManagedResult {
  exePath: string
  version: string | null
  /** 本次是否发生了安装/更新（含首次安装） */
  updated: boolean
}

/**
 * 每次连接保证最新（用户要求）：缺失即安装，有即比对，出新即更新。
 * 全部 spawnSync 串行；失败带 4KB 日志尾返回错误，绝不静默回退。
 * win 专用：非 win 直接返回明确不支持错。
 */
export function ensureAgyManaged(
  overrides?: AgyInstallOverrides,
): EnsureAgyManagedResult {
  const platform = overrides?.platform ?? process.platform
  if (platform !== 'win32') {
    throw new Error('agy 运行时暂仅支持 Windows（单文件 exe），当前平台不支持')
  }
  const npm = resolveAgyNpmBin(overrides)
  if (!npm) {
    throw new Error(buildAgyMissingNpmMessage())
  }
  const spawn = overrides?.spawn ?? spawnSync
  const managedDir = resolveAgyManagedDir(overrides)
  const pkgDir = resolveAgyPkgDir(overrides)
  const exePath = resolveAgyExePath(overrides)

  const installedVersion = defaultExistsSync(exePath) ? readInstalledAgyVersion(pkgDir) : null
  // 缺失即安装：exe 或版本号任一缺失都走安装
  if (!defaultExistsSync(exePath) || !installedVersion) {
    mkdirSync(managedDir, { recursive: true })
    const inv = resolveAgyNpmInvocation(
      npm,
      ['install', '--prefix', managedDir, '--no-audit', '--no-fund', `${AGY_ACP_NPM_PACKAGE}@latest`],
      overrides,
    )
    const result = spawn(inv.file, inv.args, {
      encoding: 'utf8',
      timeout: 600_000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
      shell: inv.shell,
    })
    const logTail = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.slice(-4000)
    if (result.error) {
      throw new Error(`agy 安装失败：${result.error.message}\n${logTail}`)
    }
    if (result.status !== 0) {
      throw new Error(`agy 安装失败：npm install 退出码 ${result.status}\n${logTail}`)
    }
    if (!defaultExistsSync(exePath)) {
      throw new Error(`agy 安装完成但找不到入口 ${AGY_MANAGED_EXE_REL}，包内容异常。\n${logTail}`)
    }
    return { exePath, version: readInstalledAgyVersion(pkgDir), updated: true }
  }

  // 已安装：比对 registry，出新即更新
  const latest = latestAgyVersion(overrides)
  if (latest && compareAgyVersions(latest, installedVersion) > 0) {
    const inv = resolveAgyNpmInvocation(
      npm,
      ['install', '--prefix', managedDir, '--no-audit', '--no-fund', `${AGY_ACP_NPM_PACKAGE}@latest`],
      overrides,
    )
    const result = spawn(inv.file, inv.args, {
      encoding: 'utf8',
      timeout: 600_000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
      shell: inv.shell,
    })
    const logTail = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.slice(-4000)
    if (result.error) {
      throw new Error(`agy 更新失败：${result.error.message}\n${logTail}`)
    }
    if (result.status !== 0) {
      throw new Error(`agy 更新失败：npm install 退出码 ${result.status}\n${logTail}`)
    }
    return { exePath, version: readInstalledAgyVersion(pkgDir) ?? latest, updated: true }
  }

  return { exePath, version: installedVersion, updated: false }
}
