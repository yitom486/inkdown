import { describe, expect, it, vi } from 'vitest'
import { err, ok } from '@shared/core/result'
import { inspectIndexedContentForAgent } from './inspect-indexed-content'

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
})
