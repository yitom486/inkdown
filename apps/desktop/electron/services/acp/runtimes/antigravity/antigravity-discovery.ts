import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export interface DiscoveredAntigravityServer {
  executablePath: string
  dir: string
  version?: string
  source: 'env' | 'zed_cache' | 'app_cache' | 'path'
  harnessPath?: string
}

function getExecutableNames(): { exeName: string; harnessName: string } {
  const isWin = process.platform === 'win32'
  return {
    exeName: isWin ? 'agy_acp_server.exe' : 'agy_acp_server.par',
    harnessName: isWin ? 'localharness_external.exe' : 'localharness_external',
  }
}

function getZedRegistryCandidates(): string[] {
  const isWin = process.platform === 'win32'
  const isMac = process.platform === 'darwin'

  if (isWin) {
    const localAppData = process.env.LOCALAPPDATA?.trim() || join(homedir(), 'AppData', 'Local')
    return [join(localAppData, 'Zed', 'external_agents', 'registry', 'antigravity-acp')]
  }

  if (isMac) {
    return [
      join(
        homedir(),
        'Library',
        'Application Support',
        'Zed',
        'external_agents',
        'registry',
        'antigravity-acp',
      ),
    ]
  }

  return [
    join(homedir(), '.local', 'share', 'zed', 'external_agents', 'registry', 'antigravity-acp'),
  ]
}

function findInPath(exeName: string): string | null {
  const pathEnv = process.env.PATH ?? ''
  const delimiter = process.platform === 'win32' ? ';' : ':'
  const dirs = pathEnv.split(delimiter).filter(Boolean)

  for (const dir of dirs) {
    const full = join(dir, exeName)
    if (existsSync(full)) {
      return full
    }
  }
  return null
}

/**
 * 发现官方 Google Antigravity agy_acp_server 二进制文件：
 * 1. 显式环境变量 AGY_ACP_SERVER_PATH
 * 2. Zed ACP 外部 Agent 缓存目录（若本机 Zed 曾下载过）
 * 3. 应用自带运行时缓存目录 ~/.gemini/antigravity-acp/runtime/
 * 4. 系统 PATH
 */
export function findAntigravityServer(customPath?: string): DiscoveredAntigravityServer | null {
  const { exeName, harnessName } = getExecutableNames()

  // 1. 显式参数 / 环境变量
  const envPath = customPath?.trim() || process.env.AGY_ACP_SERVER_PATH?.trim()
  if (envPath && existsSync(envPath)) {
    const dir = dirname(envPath)
    const harness = join(dir, harnessName)
    return {
      executablePath: envPath,
      dir,
      source: 'env',
      harnessPath: existsSync(harness) ? harness : undefined,
    }
  }

  // 2. Zed 外部 Agent 缓存目录（检查所有版本子目录，优先选择版本号最新的）
  for (const base of getZedRegistryCandidates()) {
    if (!existsSync(base)) continue
    try {
      const entries = readdirSync(base, { withFileTypes: true })
      const versionDirs = entries
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))

      for (const ver of versionDirs) {
        const candidateExe = join(base, ver, exeName)
        if (existsSync(candidateExe)) {
          const dir = join(base, ver)
          const harness = join(dir, harnessName)
          return {
            executablePath: candidateExe,
            dir,
            version: ver,
            source: 'zed_cache',
            harnessPath: existsSync(harness) ? harness : undefined,
          }
        }
      }
    } catch {
      // 忽略文件读取异常，继续尝试其它候选
    }
  }

  // 3. 应用自带运行时目录 (~/.gemini/antigravity-acp/runtime/ 或 ~/.gemini/runtime/)
  const appCandidates = [
    join(homedir(), '.gemini', 'antigravity-acp', 'runtime'),
    join(homedir(), '.gemini', 'runtime'),
  ]
  for (const dir of appCandidates) {
    const candidateExe = join(dir, exeName)
    if (existsSync(candidateExe)) {
      const harness = join(dir, harnessName)
      return {
        executablePath: candidateExe,
        dir,
        source: 'app_cache',
        harnessPath: existsSync(harness) ? harness : undefined,
      }
    }
  }

  // 4. 系统 PATH
  const fromPath = findInPath(exeName)
  if (fromPath) {
    const dir = dirname(fromPath)
    const harness = join(dir, harnessName)
    return {
      executablePath: fromPath,
      dir,
      source: 'path',
      harnessPath: existsSync(harness) ? harness : undefined,
    }
  }

  return null
}
