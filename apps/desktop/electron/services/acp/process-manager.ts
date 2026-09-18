import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import type { AcpRuntimeInfo } from '@inkdown/contracts'
import { ANTIGRAVITY_ACP_RUNTIME_ID } from '@inkdown/contracts'
import { findAntigravityServer } from './antigravity-discovery'

export interface SpawnedAcpProcess {
  runtimeId: string
  child: ChildProcessWithoutNullStreams
  kill: () => void
}

const active = new Map<string, SpawnedAcpProcess>()

export interface SpawnAcpOptions {
  runtime: AcpRuntimeInfo
  cwd: string
  env?: NodeJS.ProcessEnv
  /** 需要从继承环境里剔除的变量名（如关闭代理时清理 HTTP(S)_PROXY） */
  envRemove?: string[]
  onStderrLine?: (line: string) => void
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void
}

function resolveCommand(runtime: AcpRuntimeInfo): { file: string; shell: boolean } {
  if (runtime.id === ANTIGRAVITY_ACP_RUNTIME_ID || runtime.command === 'agy_acp_server') {
    const discovered = findAntigravityServer()
    if (discovered) {
      return { file: discovered.executablePath, shell: false }
    }
  }

  // Windows 上 bunx 常为 .cmd，需 shell
  if (process.platform === 'win32') {
    return { file: runtime.command, shell: true }
  }
  return { file: runtime.command, shell: false }
}

export function spawnAcpProcess(options: SpawnAcpOptions): SpawnedAcpProcess {
  const existing = active.get(options.runtime.id)
  if (existing) {
    existing.kill()
  }

  const { file, shell } = resolveCommand(options.runtime)
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...options.env,
  }
  for (const key of options.envRemove ?? []) {
    delete env[key]
  }

  // 过滤 Python/PyInstaller 临时环境变量，避免嵌入式运行时校验中断
  for (const key of Object.keys(env)) {
    if (key.startsWith('_PYI') || key.startsWith('_MEI')) {
      delete env[key]
    }
  }

  // 默认允许本机浏览器 OAuth（对齐 VS Code/Zed）；无头/CI 才禁用
  const forceNoBrowser =
    process.env.INKDOWN_ACP_NO_BROWSER === '1' ||
    process.env.CI === 'true' ||
    process.env.CI === '1'
  if (forceNoBrowser) {
    env.NO_BROWSER = '1'
  } else {
    delete env.NO_BROWSER
  }

  const child = spawn(file, options.runtime.args, {
    cwd: options.cwd,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell,
    windowsHide: true,
  }) as ChildProcessWithoutNullStreams

  let stderrBuffer = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk: string) => {
    stderrBuffer += chunk
    while (true) {
      const idx = stderrBuffer.indexOf('\n')
      if (idx < 0) break
      const line = stderrBuffer.slice(0, idx).replace(/\r$/, '')
      stderrBuffer = stderrBuffer.slice(idx + 1)
      if (line.trim()) {
        if (process.env.NODE_ENV !== 'production') {
          console.error(`[acp:${options.runtime.id}]`, line)
        }
        options.onStderrLine?.(line)
      }
    }
  })

  const handle: SpawnedAcpProcess = {
    runtimeId: options.runtime.id,
    child,
    kill: () => {
      if (!child.killed) {
        child.kill()
      }
      active.delete(options.runtime.id)
    },
  }

  child.on('exit', (code, signal) => {
    active.delete(options.runtime.id)
    options.onExit?.(code, signal)
  })

  active.set(options.runtime.id, handle)
  return handle
}

export function disposeAllAcpProcesses(): void {
  for (const handle of [...active.values()]) {
    handle.kill()
  }
  active.clear()
}

export function getActiveAcpProcess(runtimeId: string): SpawnedAcpProcess | undefined {
  return active.get(runtimeId)
}
