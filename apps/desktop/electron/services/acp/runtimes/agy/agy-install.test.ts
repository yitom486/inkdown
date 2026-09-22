import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { spawnSync as spawnSyncType } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import {
  buildAgyMissingNpmMessage,
  compareAgyVersions,
  ensureAgyManaged,
  latestAgyVersion,
  resolveAgyExePath,
  resolveAgyNpmBin,
  resolveAgyNpmInvocation,
} from './agy-install'
import { AGY_ACP_NPM_PACKAGE } from '@inkdown/contracts'

type SpawnFn = typeof spawnSyncType

function fakeSpawn(
  impl: (command: string, args: string[]) => { status: number; stdout: string; stderr: string; error?: Error },
): SpawnFn {
  return ((command: string, args: string[]) => {
    const result = impl(command, args)
    return {
      ...result,
      error: result.error,
      pid: 1,
      output: [],
      signal: null,
    }
  }) as unknown as SpawnFn
}

/** 含 npm.cmd 的临时 PATH 环境 */
function npmEnv(): { dir: string; env: NodeJS.ProcessEnv } {
  const dir = mkdtempSync(join(tmpdir(), 'inkdown-agy-npm-'))
  writeFileSync(join(dir, 'npm.cmd'), '@echo off', 'utf8')
  return { dir, env: { PATH: dir } }
}

function managedSetup(opts?: { version?: string; withExe?: boolean }): {
  userDataDir: string
  cleanup: () => void
} {
  const userDataDir = mkdtempSync(join(tmpdir(), 'inkdown-agy-home-'))
  if (opts?.version !== undefined || opts?.withExe) {
    const pkgDir = join(userDataDir, 'agents', 'agy', 'node_modules', AGY_ACP_NPM_PACKAGE)
    mkdirSync(join(pkgDir, 'dist'), { recursive: true })
    if (opts?.version !== undefined) {
      writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ version: opts.version }), 'utf8')
    }
    if (opts?.withExe) {
      writeFileSync(join(pkgDir, 'dist', 'agy-acp-win-x64.exe'), 'fake-exe', 'utf8')
      if (opts.version === undefined) {
        writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ version: '0.0.0' }), 'utf8')
      }
    }
  }
  return {
    userDataDir,
    cleanup: () => rmSync(userDataDir, { recursive: true, force: true }),
  }
}

describe('compareAgyVersions（数字比对）', () => {
  it('新版判大：0.1.6 > 0.1.2', () => {
    expect(compareAgyVersions('0.1.6', '0.1.2')).toBe(1)
    expect(compareAgyVersions('0.1.2', '0.1.6')).toBe(-1)
    expect(compareAgyVersions('0.1.6', '0.1.6')).toBe(0)
  })

  it('不等长按缺位补 0：1.2 > 1.2.0? 相等', () => {
    expect(compareAgyVersions('1.2', '1.2.0')).toBe(0)
    expect(compareAgyVersions('1.10.0', '1.9.9')).toBe(1)
  })
})

describe('resolveAgyNpmBin（缺失 npm 中文友好错）', () => {
  it('PATH 无 npm.cmd 返回 null，文案中文友好', () => {
    const empty = mkdtempSync(join(tmpdir(), 'inkdown-agy-empty-'))
    try {
      expect(resolveAgyNpmBin({ platform: 'win32', env: { PATH: empty } })).toBeNull()
      expect(buildAgyMissingNpmMessage()).toContain('npm')
      expect(ensureAgyManaged).toBeTypeOf('function')
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })

  it('PATH 命中 npm.cmd 透传绝对路径', () => {
    const { dir, env } = npmEnv()
    try {
      expect(resolveAgyNpmBin({ platform: 'win32', env })).toBe(join(dir, 'npm.cmd'))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('ensureAgyManaged（每次连接保证最新，失败透错不静默）', () => {
  it('非 win 返回明确不支持错', () => {
    const { dir, env } = npmEnv()
    const { userDataDir, cleanup } = managedSetup()
    try {
      expect(() =>
        ensureAgyManaged({ platform: 'linux', env, userDataDir }),
      ).toThrow('暂仅支持 Windows')
    } finally {
      rmSync(dir, { recursive: true, force: true })
      cleanup()
    }
  })

  it('缺失 npm 即中文友好错（不触达安装）', () => {
    const empty = mkdtempSync(join(tmpdir(), 'inkdown-agy-nonpm-'))
    const { userDataDir, cleanup } = managedSetup()
    try {
      expect(() =>
        ensureAgyManaged({
          platform: 'win32',
          env: { PATH: empty },
          userDataDir,
        }),
      ).toThrow('找不到 npm')
    } finally {
      rmSync(empty, { recursive: true, force: true })
      cleanup()
    }
  })

  it('缺失即安装：exe 不存在时 npm install，updated=true', () => {
    const { dir, env } = npmEnv()
    const { userDataDir, cleanup } = managedSetup()
    try {
      const spawn = fakeSpawn((command, args) => {
        expect(command).toBe(join(dir, 'npm.cmd'))
        expect(args).toContain(`${AGY_ACP_NPM_PACKAGE}@latest`)
        // 模拟安装落盘
        const pkgDir = join(userDataDir, 'agents', 'agy', 'node_modules', AGY_ACP_NPM_PACKAGE)
        mkdirSync(join(pkgDir, 'dist'), { recursive: true })
        writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ version: '0.1.6' }), 'utf8')
        writeFileSync(join(pkgDir, 'dist', 'agy-acp-win-x64.exe'), 'fake-exe', 'utf8')
        return { status: 0, stdout: 'ok', stderr: '' }
      })
      const result = ensureAgyManaged({ platform: 'win32', env, userDataDir, spawn })
      expect(result.exePath).toBe(resolveAgyExePath({ userDataDir }))
      expect(result.updated).toBe(true)
      expect(result.version).toBe('0.1.6')
    } finally {
      rmSync(dir, { recursive: true, force: true })
      cleanup()
    }
  })

  it('安装失败透错：带 4KB 日志尾，绝不静默', () => {
    const { dir, env } = npmEnv()
    const { userDataDir, cleanup } = managedSetup()
    try {
      const spawn = fakeSpawn(() => ({
        status: 1,
        stdout: 'out',
        stderr: 'E_TAIL_MARKER',
      }))
      expect(() =>
        ensureAgyManaged({ platform: 'win32', env, userDataDir, spawn }),
      ).toThrow(/agy 安装失败.*E_TAIL_MARKER/s)
    } finally {
      rmSync(dir, { recursive: true, force: true })
      cleanup()
    }
  })

  it('有即比对：registry 出新即更新（updated=true）；无新则不装（updated=false）', () => {
    const { dir, env } = npmEnv()
    // 更新路径：已装 0.1.2，registry 0.1.6
    const setup1 = managedSetup({ version: '0.1.2', withExe: true })
    try {
      let installs = 0
      const spawn = fakeSpawn((command, args) => {
        if (args[0] === 'view') return { status: 0, stdout: '0.1.6\n', stderr: '' }
        installs += 1
        return { status: 0, stdout: 'updated', stderr: '' }
      })
      const result = ensureAgyManaged({
        platform: 'win32',
        env,
        userDataDir: setup1.userDataDir,
        spawn,
      })
      expect(result.updated).toBe(true)
      expect(installs).toBe(1)
    } finally {
      setup1.cleanup()
    }
    // 无新路径：已装 0.1.6，registry 同版
    const setup2 = managedSetup({ version: '0.1.6', withExe: true })
    try {
      let installs = 0
      const spawn = fakeSpawn((command, args) => {
        if (args[0] === 'view') return { status: 0, stdout: '0.1.6\n', stderr: '' }
        installs += 1
        return { status: 0, stdout: '', stderr: '' }
      })
      const result = ensureAgyManaged({
        platform: 'win32',
        env,
        userDataDir: setup2.userDataDir,
        spawn,
      })
      expect(result.updated).toBe(false)
      expect(installs).toBe(0)
    } finally {
      setup2.cleanup()
    }
    rmSync(dir, { recursive: true, force: true })
  })

  it('latestVersion 失败返回 null（registry 不可达不阻断已安装复用）', () => {
    const { dir, env } = npmEnv()
    try {
      const spawn = fakeSpawn(() => ({ status: 1, stdout: '', stderr: 'nope' }))
      expect(latestAgyVersion({ platform: 'win32', env, spawn })).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('resolveAgyNpmInvocation（win npm.cmd EINVAL 规避）', () => {
  const npm = join('C:', 'Program Files', 'nodejs', 'npm.cmd')

  it('node.exe + npm-cli.js 俱在时免 shell 直调', () => {
    const exists = (p: string) => p.endsWith('node.exe') || p.endsWith('npm-cli.js')
    const inv = resolveAgyNpmInvocation(npm, ['view', 'x', 'version'], {
      platform: 'win32',
      exists,
    })
    expect(inv.file.endsWith('node.exe')).toBe(true)
    expect(inv.args[0]!.endsWith('npm-cli.js')).toBe(true)
    expect(inv.args.slice(1)).toEqual(['view', 'x', 'version'])
    expect(inv.shell).toBe(false)
  })

  it('缺 node 运行时回落 shell 起 npm.cmd', () => {
    const inv = resolveAgyNpmInvocation(npm, ['view', 'x', 'version'], {
      platform: 'win32',
      exists: () => false,
    })
    expect(inv.file).toBe(npm)
    expect(inv.args).toEqual(['view', 'x', 'version'])
    expect(inv.shell).toBe(true)
  })

  it('posix 原样直调不套 shell', () => {
    const inv = resolveAgyNpmInvocation('/usr/bin/npm', ['view', 'x', 'version'], {
      platform: 'linux',
    })
    expect(inv).toEqual({ file: '/usr/bin/npm', args: ['view', 'x', 'version'], shell: false })
  })
})
