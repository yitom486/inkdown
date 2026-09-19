import { execFile } from 'node:child_process'
import { readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const ANTIGRAVITY_IMAGE_NAMES =
  process.platform === 'win32'
    ? ['agy_acp_server.exe', 'localharness_external.exe']
    : ['agy_acp_server', 'localharness_external']

// PyInstaller onefile 冷启动解压目录：_MEI + 若干位 36 进制随机后缀
const MEI_DIR_PATTERN = /^_MEI[0-9A-Za-z]{5,}$/
// 官方进程运行时顺手建的空工作目录（Node mkdtemp 风格：前缀 + 6 位随机），从不自清
const DOT_TMP_DIR_PATTERN = /^\.tmp[A-Za-z0-9]{6}$/

const DEFAULT_LIVE_MAX_AGE_MS = 24 * 3600 * 1000
const DEFAULT_IDLE_MAX_AGE_MS = 30 * 60 * 1000

export interface TempSweepOptions {
  /** 默认 os.tmpdir()；单测注入隔离目录 */
  tmpRoot?: string
  /** 有存活 ACP 进程时只删超过此年龄的（默认 24h，绝不碰温进程的目录） */
  liveMaxAgeMs?: number
  /** 无存活进程时删超过此年龄的（默认 30min，给刚 spawn 的留余量） */
  idleMaxAgeMs?: number
  /** 存活进程计数（默认按映像名探测；单测注入） */
  countLiveProcesses?: () => Promise<number>
}

export interface TempSweepResult {
  scanned: number
  removed: string[]
  skipped: number
}

/**
 * 按映像名统计存活的官方 ACP 进程数。探测失败时按“有存活”保守返回，
 * 调用方此时只会删除 24h+ 的陈年垃圾，不会误伤。
 */
export async function countLiveAntigravityProcesses(): Promise<number> {
  try {
    if (process.platform === 'win32') {
      let total = 0
      for (const image of ANTIGRAVITY_IMAGE_NAMES) {
        const { stdout } = await execFileAsync('tasklist', [
          '/FI',
          `IMAGENAME eq ${image}`,
          '/FO',
          'CSV',
          '/NH',
        ])
        for (const line of stdout.split('\n')) {
          if (line.toLowerCase().includes(`"${image.toLowerCase()}"`)) total += 1
        }
      }
      return total
    }
    const { stdout } = await execFileAsync('pgrep', [
      '-f',
      '-c',
      'agy_acp_server|localharness_external',
    ])
    const n = Number.parseInt(stdout.trim(), 10)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 1
  }
}

export function isAntigravityTempDirName(name: string): boolean {
  return MEI_DIR_PATTERN.test(name) || DOT_TMP_DIR_PATTERN.test(name)
}

/**
 * 清扫官方 ACP 进程遗留的临时目录（_MEI* 解压目录与 .tmp* 空工作目录）。
 *
 * 安全规则：
 * - 有存活进程时只删 liveMaxAgeMs 以上的（温进程/Zed 共存实例的目录必然新鲜，碰不到）；
 * - 正在被占用的目录（DLL 锁）删除失败会被跳过，不抛错；
 * - 名称不匹配的目录/文件一律不动。
 */
export async function sweepStaleAntigravityTempDirs(
  options: TempSweepOptions = {},
): Promise<TempSweepResult> {
  const tmpRoot = options.tmpRoot ?? tmpdir()
  const liveMaxAgeMs = options.liveMaxAgeMs ?? DEFAULT_LIVE_MAX_AGE_MS
  const idleMaxAgeMs = options.idleMaxAgeMs ?? DEFAULT_IDLE_MAX_AGE_MS
  const result: TempSweepResult = { scanned: 0, removed: [], skipped: 0 }

  let entries: string[]
  try {
    entries = await readdir(tmpRoot)
  } catch {
    return result
  }

  const live = await (options.countLiveProcesses ?? countLiveAntigravityProcesses)()
  const maxAgeMs = live > 0 ? liveMaxAgeMs : idleMaxAgeMs
  const now = Date.now()

  for (const name of entries) {
    if (!isAntigravityTempDirName(name)) continue
    result.scanned += 1
    const full = join(tmpRoot, name)
    try {
      const st = await stat(full)
      if (!st.isDirectory()) {
        result.skipped += 1
        continue
      }
      if (now - st.mtimeMs < maxAgeMs) {
        result.skipped += 1
        continue
      }
      await rm(full, { recursive: true, force: true })
      result.removed.push(full)
    } catch {
      // 被占用/竞态删除：跳过即可，下次启动再试
      result.skipped += 1
    }
  }
  return result
}
