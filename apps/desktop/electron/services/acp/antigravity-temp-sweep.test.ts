import { mkdtemp, rm, mkdir, writeFile, stat } from 'node:fs/promises'
import { utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sweepStaleAntigravityTempDirs } from './antigravity-temp-sweep'

let root: string

async function makeOldDir(name: string): Promise<string> {
  const full = join(root, name)
  await mkdir(full, { recursive: true })
  const ancient = new Date(Date.now() - 3 * 24 * 3600 * 1000)
  utimesSync(full, ancient, ancient)
  return full
}

async function makeFreshDir(name: string): Promise<string> {
  const full = join(root, name)
  await mkdir(full, { recursive: true })
  return full
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'inkdown-sweep-test-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

describe('sweepStaleAntigravityTempDirs', () => {
  it('无存活进程时删除过期 _MEI 与 .tmp 目录，保留新鲜与无关项', async () => {
    const oldMei = await makeOldDir('_MEI0000cf602')
    const oldTmp = await makeOldDir('.tmpyDwgUJ')
    const freshMei = await makeFreshDir('_MEI00007b902')
    const freshTmp = await makeFreshDir('.tmpW0VPeT')
    const unrelated = await makeOldDir('keep-me-around')
    const decoyFile = join(root, '_MEI0000ffff')
    await writeFile(decoyFile, 'not a dir')

    const result = await sweepStaleAntigravityTempDirs({
      tmpRoot: root,
      idleMaxAgeMs: 60_000,
      countLiveProcesses: async () => 0,
    })

    expect(result.removed).toContain(oldMei)
    expect(result.removed).toContain(oldTmp)
    expect(await exists(oldMei)).toBe(false)
    expect(await exists(oldTmp)).toBe(false)
    expect(await exists(freshMei)).toBe(true)
    expect(await exists(freshTmp)).toBe(true)
    expect(await exists(unrelated)).toBe(true)
    expect(await exists(decoyFile)).toBe(true)
  })

  it('有存活进程时只动超过 liveMaxAgeMs 的陈年目录', async () => {
    const oldMei = await makeOldDir('_MEI00001be02')
    const oldTmp = await makeOldDir('.tmpbM9FF7')

    const result = await sweepStaleAntigravityTempDirs({
      tmpRoot: root,
      // 30 天：3 天前的残留在此阈值下也视为“不够老”，必须保留
      liveMaxAgeMs: 30 * 24 * 3600 * 1000,
      countLiveProcesses: async () => 2,
    })

    expect(result.removed).toHaveLength(0)
    expect(await exists(oldMei)).toBe(true)
    expect(await exists(oldTmp)).toBe(true)
  })
})
