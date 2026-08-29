import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import type { AcpRuntimeInfo } from '@shared/types/acp'

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
  onStderrLine?: (line: string) => void
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void
}

function resolveCommand(command: string): { file: string; shell: boolean } {
  // Windows 上 bunx 常为 .cmd，需 shell
  if (process.platform === 'win32') {
    return { file: command, shell: true }
  }
  return { file: command, shell: false }
}

export function spawnAcpProcess(options: SpawnAcpOptions): SpawnedAcpProcess {
  const existing = active.get(options.runtime.id)
  if (existing) {
    existing.kill()
  }

  const { file, shell } = resolveCommand(options.runtime.command)
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...options.env,
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
