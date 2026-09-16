import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let tempRoot = ''

vi.mock('electron', () => ({
  app: {
    getPath: () => tempRoot,
  },
}))

import { downloadResourceToFile, HashMismatchError } from './inspector-ocr-runtime'

function stubFetch(
  impl: (url: string) => { ok: boolean; status: number; bytes: Buffer } | Promise<{ ok: boolean; status: number; bytes: Buffer }>,
): ReturnType<typeof vi.fn> {
  const calls: string[] = []
  const fn = vi.fn(async (url: string) => {
    calls.push(String(url))
    const result = await impl(String(url))
    return {
      ok: result.ok,
      status: result.status,
      arrayBuffer: async () => result.bytes,
    }
  })
  ;(fn as unknown as { calls: string[] }).calls = calls
  vi.stubGlobal('fetch', fn)
  return fn
}

const shaOf = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex')

describe('downloadResourceToFile', () => {
  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'ocr-dl-'))
  })
  afterEach(async () => {
    vi.unstubAllGlobals()
    await rm(tempRoot, { recursive: true, force: true })
  })

  it('哈希失败且 size 相符：一次即抛，不重试 3 次，信息定位到文件', async () => {
    const bytes = Buffer.from('definitely-not-the-model')
    const fetchFn = stubFetch(() => ({ ok: true, status: 200, bytes }))
    const dest = join(tempRoot, 'pp-ocrv6_small_det.onnx')
    const expected = shaOf(Buffer.from('the-real-model-bytes'))
    let error: Error | null = null
    try {
      await downloadResourceToFile({
        url: 'https://github.com/GreatV/oar-ocr/releases/download/v0.7.0/pp-ocrv6_small_det.onnx',
        dest,
        expectedSha256: expected,
        expectedSize: bytes.length,
        resourceName: 'pp-ocrv6_small_det.onnx',
      })
    } catch (cause) {
      error = cause as Error
    }
    expect(error).toBeInstanceOf(HashMismatchError)
    if (!error) throw new Error('expected HashMismatchError')
    const message = error.message
    // 确定性失败：只打一次，不睡 1s/2s 重试
    expect(fetchFn).toHaveBeenCalledTimes(1)
    // 信息带资源名/主机路径/字节数/期望与实际哈希前 12 位/未写入
    expect(message).toContain('pp-ocrv6_small_det.onnx')
    expect(message).toContain('github.com/GreatV/oar-ocr/releases/download/v0.7.0/pp-ocrv6_small_det.onnx')
    expect(message).toContain(`${bytes.length} 字节`)
    expect(message).toContain(expected.slice(0, 12))
    expect(message).toContain(shaOf(bytes).slice(0, 12))
    expect(message).toContain('已拒绝安装、未写入任何文件')
    expect(message).not.toContain('已重试')
    // 未写入任何文件
    await expect(readFile(dest)).rejects.toThrow()
  })

  it('HTTP 5xx 后成功：仍重试并写盘', async () => {
    const bytes = Buffer.from('model-bytes-ok')
    let calls = 0
    stubFetch(() => {
      calls += 1
      if (calls === 1) return { ok: false, status: 503, bytes: Buffer.alloc(0) }
      return { ok: true, status: 200, bytes }
    })
    const dest = join(tempRoot, 'm.onnx')
    await downloadResourceToFile({
      url: 'https://example.com/m.onnx',
      dest,
      expectedSha256: shaOf(bytes),
      resourceName: 'm.onnx',
    })
    expect(calls).toBe(2)
    expect((await readFile(dest)).equals(bytes)).toBe(true)
  }, 15000)

  it('哈希正确：一次写盘', async () => {
    const bytes = Buffer.from('exact-bytes')
    const fetchFn = stubFetch(() => ({ ok: true, status: 200, bytes }))
    const dest = join(tempRoot, 'ok.onnx')
    await downloadResourceToFile({
      url: 'https://example.com/ok.onnx',
      dest,
      expectedSha256: shaOf(bytes),
      expectedSize: bytes.length,
      resourceName: 'ok.onnx',
    })
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect((await readFile(dest)).equals(bytes)).toBe(true)
  })
})
