import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { spawnSync as spawnSyncType } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { agyAdapter, probeAgyAuth, resolveAgySpawnCommand } from './index'
import { AGY_ACP_NPM_PACKAGE } from '@inkdown/contracts'

describe('agyAdapter（中性探测 + 直连优先）', () => {
  it('probe 中性空结果（authMethods 为 []，直连即可）', () => {
    const probed = probeAgyAuth()
    expect(probed.looksLoggedIn).toBe(false)
    expect(probed.hasAuthFile).toBe(false)
    expect(probed.hasApiKeyEnv).toBe(false)
    expect(agyAdapter.probeAuth()).toEqual(probed)
  })

  it('tryDirectSessionFirst=true（authMethods 为空时直建会话）', () => {
    expect(agyAdapter.tryDirectSessionFirst).toBe(true)
    expect(agyAdapter.id).toBe('agy')
  })
})

describe('resolveAgySpawnCommand（updated 语义 + warm 失效约定）', () => {
  it('首次安装返回 exe 绝对路径 + updated=true（连接层须先杀温进程再冷启动）', () => {
    const npmDir = mkdtempSync(join(tmpdir(), 'inkdown-agy-idx-npm-'))
    const userDataDir = mkdtempSync(join(tmpdir(), 'inkdown-agy-idx-home-'))
    try {
      writeFileSync(join(npmDir, 'npm.cmd'), '@echo off', 'utf8')
      const spawn = ((() => ({
        status: 0,
        stdout: '',
        stderr: '',
        pid: 1,
        output: [],
        signal: null,
        error: undefined,
      })) as unknown as typeof spawnSyncType)
      // 预置安装副作用：spawn 被调用时落盘 exe+版本
      const wrapped = ((command: string, args: string[], opts: unknown) => {
        const pkgDir = join(userDataDir, 'agents', 'agy', 'node_modules', AGY_ACP_NPM_PACKAGE)
        mkdirSync(join(pkgDir, 'dist'), { recursive: true })
        writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ version: '0.1.6' }), 'utf8')
        writeFileSync(join(pkgDir, 'dist', 'agy-acp-win-x64.exe'), 'fake', 'utf8')
        return (spawn as unknown as (c: string, a: string[], o: unknown) => unknown)(
          command,
          args,
          opts,
        )
      }) as unknown as typeof spawnSyncType
      const resolved = resolveAgySpawnCommand({
        platform: 'win32',
        env: { PATH: npmDir },
        userDataDir,
        spawn: wrapped,
      })
      expect(resolved.command.endsWith('agy-acp-win-x64.exe')).toBe(true)
      expect(resolved.args).toEqual([])
      // updated=true：本次发生了安装——acp-connection.ts 约定先杀同 runtime
      // 温进程（Windows 运行中 exe 无法覆盖）再走冷启动
      expect(resolved.updated).toBe(true)
    } finally {
      rmSync(npmDir, { recursive: true, force: true })
      rmSync(userDataDir, { recursive: true, force: true })
    }
  })

  it('安装失败抛错透出（连接层 agy 分支转 ACP_SPAWN_ERROR，不静默回退）', () => {
    const npmDir = mkdtempSync(join(tmpdir(), 'inkdown-agy-idx-npm2-'))
    const userDataDir = mkdtempSync(join(tmpdir(), 'inkdown-agy-idx-home2-'))
    try {
      writeFileSync(join(npmDir, 'npm.cmd'), '@echo off', 'utf8')
      const failing = ((() => ({
        status: 1,
        stdout: 'out',
        stderr: 'E_FAIL_TAIL',
        pid: 1,
        output: [],
        signal: null,
        error: undefined,
      })) as unknown as typeof spawnSyncType)
      expect(() =>
        resolveAgySpawnCommand({
          platform: 'win32',
          env: { PATH: npmDir },
          userDataDir,
          spawn: failing,
        }),
      ).toThrow(/agy 安装失败/)
    } finally {
      rmSync(npmDir, { recursive: true, force: true })
      rmSync(userDataDir, { recursive: true, force: true })
    }
  })
})
