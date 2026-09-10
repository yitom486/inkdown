import { describe, expect, it, vi } from 'vitest'
import { err, ok } from '@shared/core/result'
import { useActiveDocumentStore } from '@/stores/active-document-store'
import { inspectIndexedContentForAgent } from './inspect-indexed-content'
import { registerReaderContent } from './reader-content-registry'

const RESULT = {
  query: '王道计',
  total: 1,
  truncated: false,
  limit: 10,
  hits: [
    {
      source: 'book-index' as const,
      locator: { pageNumber: 36, chapterTitle: '第2章', blockId: 7 },
      text: '王道计是出版社',
      textTruncated: false,
      matchPosition: 'start' as const,
    },
  ],
}

function deps(over: Record<string, unknown> = {}) {
  return {
    getActivePath: vi.fn((): string => '/book/demo.pdf'),
    getFingerprint: vi.fn((): string => '/book/demo.pdf|123'),
    callInspect: vi.fn(async () => ok(RESULT)),
    ...over,
  }
}

describe('inspectIndexedContentForAgent', () => {
  it('绑定当前文档指纹并返回审计 JSON', async () => {
    const d = deps()
    const text = await inspectIndexedContentForAgent('王道计', 10, d)
    expect(d.callInspect).toHaveBeenCalledWith('/book/demo.pdf|123', '王道计', 10)
    expect(JSON.parse(text)).toMatchObject({ total: 1, truncated: false })
  })

  it('无活动文档 / 未绑定指纹抛错', async () => {
    await expect(inspectIndexedContentForAgent('王道计', 10, deps({ getActivePath: () => '' }))).rejects.toThrow(
      '没有打开的文档',
    )
    await expect(inspectIndexedContentForAgent('王道计', 10, deps({ getFingerprint: () => '' }))).rejects.toThrow(
      '不支持内容审计',
    )
  })

  it('空 query 与非法 limit 抛错，不调 IPC', async () => {
    const d = deps()
    await expect(inspectIndexedContentForAgent('   ', 10, d)).rejects.toThrow('非空')
    await expect(inspectIndexedContentForAgent('王道计', Number.NaN, d)).rejects.toThrow('整数')
    expect(d.callInspect).not.toHaveBeenCalled()
  })

  it('IPC 错误向上传递为异常（快照层转工具错误）', async () => {
    const d = deps({
      callInspect: vi.fn(async () => err({ code: 'INVALID_STATE' as const, message: '本书尚未导入罗盘索引' })),
    })
    await expect(inspectIndexedContentForAgent('王道计', 10, d)).rejects.toThrow('尚未导入罗盘索引')
  })

  it('短词与非法 limit 在读正文前拒绝', async () => {
    const getBufferText = vi.fn(async (): Promise<string | null> => '正文王道计正文')
    const d = deps({ getFingerprint: () => '', getBufferText })
    await expect(inspectIndexedContentForAgent('ab', 10, d)).rejects.toThrow('至少需要 3 个字符')
    await expect(inspectIndexedContentForAgent('王道计', 0, d)).rejects.toThrow('1–10 的整数')
    expect(getBufferText).not.toHaveBeenCalled()
  })

  it('markdown 无指纹：命中编辑器内存（含未保存字串），source=editor-buffer', async () => {
    const getBufferText = vi.fn(
      async (): Promise<string | null> => '第一章\n未保存的王道计草稿\n尾声',
    )
    const callInspect = vi.fn()
    const d = deps({ getFingerprint: () => '', getBufferText, callInspect })
    const text = await inspectIndexedContentForAgent('王道计', 10, d)
    expect(callInspect).not.toHaveBeenCalled()
    const parsed = JSON.parse(text) as {
      total: number
      truncated: boolean
      hits: Array<{
        source: string
        locator: Record<string, unknown>
        text: string
        matchPosition: string
      }>
    }
    expect(parsed.total).toBe(1)
    expect(parsed.truncated).toBe(false)
    expect(parsed.hits).toHaveLength(1)
    expect(parsed.hits[0]?.source).toBe('editor-buffer')
    expect(parsed.hits[0]?.locator).toEqual({ lineStart: 2 })
    expect(parsed.hits[0]?.text).toContain('未保存的王道计草稿')
    expect(parsed.hits[0]).not.toHaveProperty('pageNumber')
  })

  it('内存 limit 截断不影响精确 total', async () => {
    const getBufferText = vi.fn(
      async (): Promise<string | null> =>
        Array.from({ length: 5 }, (_, i) => `第${i + 1}行王道计`).join('\n'),
    )
    const d = deps({ getFingerprint: () => '', getBufferText })
    const parsed = JSON.parse(await inspectIndexedContentForAgent('王道计', 2, d)) as {
      total: number
      truncated: boolean
      limit: number
      hits: unknown[]
    }
    expect(parsed.total).toBe(5)
    expect(parsed.truncated).toBe(true)
    expect(parsed.limit).toBe(2)
    expect(parsed.hits).toHaveLength(2)
  })

  it('空 buffer 与零命中返回 total=0 合法 JSON', async () => {
    const d = deps({ getFingerprint: () => '', getBufferText: vi.fn(async () => '') })
    expect(JSON.parse(await inspectIndexedContentForAgent('王道计', 10, d))).toMatchObject({
      total: 0,
      hits: [],
      truncated: false,
    })
    const d2 = deps({
      getFingerprint: () => '',
      getBufferText: vi.fn(async () => '纯正文无命中'),
    })
    expect(JSON.parse(await inspectIndexedContentForAgent('王道计', 10, d2))).toMatchObject({
      total: 0,
      hits: [],
    })
  })

  it('PDF 无指纹仍拒绝，不读 getCurrentText', async () => {
    // getBufferText 返回 null = 非 markdown/未绑定（EPUB 同理）
    const getBufferText = vi.fn(async (): Promise<string | null> => null)
    const d = deps({ getFingerprint: () => '', getBufferText })
    await expect(inspectIndexedContentForAgent('王道计', 10, d)).rejects.toThrow('不支持内容审计')
  })

  it('默认接线：markdown 读内存、epub 拒绝、错文件拒绝', async () => {
    const callInspect = vi.fn()
    const base = { getFingerprint: () => '', callInspect }
    // markdown：编辑器内存命中
    useActiveDocumentStore.setState({ filePath: '/doc/note.md' })
    const unregisterMd = registerReaderContent({
      filePath: '/doc/note.md',
      getCurrentText: () => '# 标题\n内存王道计文本',
    })
    try {
      const parsed = JSON.parse(await inspectIndexedContentForAgent('王道计', 10, base)) as {
        total: number
        hits: Array<{ source: string; locator: Record<string, unknown> }>
      }
      expect(callInspect).not.toHaveBeenCalled()
      expect(parsed.total).toBe(1)
      expect(parsed.hits[0]?.source).toBe('editor-buffer')
      expect(parsed.hits[0]?.locator).toEqual({ lineStart: 2 })
    } finally {
      unregisterMd()
    }
    // epub：同样无指纹，但 kind 判定拒绝，不读内存
    useActiveDocumentStore.setState({ filePath: '/book/demo.epub' })
    const unregisterEpub = registerReaderContent({
      filePath: '/book/demo.epub',
      getCurrentText: () => '内存王道计文本',
    })
    try {
      await expect(inspectIndexedContentForAgent('王道计', 10, base)).rejects.toThrow('不支持内容审计')
    } finally {
      unregisterEpub()
    }
    // provider 与活动文档不是同一文件：拒绝
    useActiveDocumentStore.setState({ filePath: '/doc/other.md' })
    const unregisterStale = registerReaderContent({
      filePath: '/doc/note.md',
      getCurrentText: () => '内存王道计文本',
    })
    try {
      await expect(inspectIndexedContentForAgent('王道计', 10, base)).rejects.toThrow('不支持内容审计')
    } finally {
      unregisterStale()
      useActiveDocumentStore.setState({ filePath: null })
    }
  })
})
