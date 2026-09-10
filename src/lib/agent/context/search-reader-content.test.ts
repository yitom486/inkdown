import { describe, expect, it, vi } from 'vitest'
import { registerReaderContent } from './reader-content-registry'
import { searchReaderContent } from './search-reader-content'

function epubProvider() {
  return registerReaderContent({
    filePath: '/book/demo.epub',
    getCurrentText: () => '正文王道计正文',
    iterateUnits: async function* () {
      yield { label: '第一章', text: '正文王道计正文' }
    },
  })
}

describe('searchReaderContent', () => {
  it('空 query 抛错，不碰 iterateUnits', async () => {
    const next = vi.fn()
    const unregister = registerReaderContent({
      filePath: '/book/demo.epub',
      getCurrentText: () => '',
      iterateUnits: async function* () {
        next()
        yield { label: '第一章', text: '王道计' }
      },
    })
    try {
      await expect(searchReaderContent('   ')).rejects.toThrow('不能为空')
      expect(next).not.toHaveBeenCalled()
    } finally {
      unregister()
    }
  })

  it('无 provider 抛错', async () => {
    await expect(searchReaderContent('王道计')).rejects.toThrow('没有打开的文档')
  })

  it('普通 provider（EPUB 形态）仍出 hits', async () => {
    const unregister = epubProvider()
    try {
      const result = await searchReaderContent('王道计')
      expect(result.totalMatches).toBe(1)
      expect(result.hits).toHaveLength(1)
      expect(result.hits[0]?.snippet).toContain('王道计')
      // S2：缺省即 memory，精确总数恒 false
      expect(result.source).toBe('memory')
      expect(result.preciseTotal).toBe(false)
    } finally {
      unregister()
    }
  })

  it('provider 标 index 时来源为 index，hits 算法相同', async () => {
    const unregister = registerReaderContent({
      filePath: '/book/indexed.pdf',
      fileFingerprint: '/book/indexed.pdf|9',
      searchSource: 'index',
      getCurrentText: () => '',
      iterateUnits: async function* () {
        yield { label: '第一章', text: '正文王道计正文' }
      },
    })
    try {
      const result = await searchReaderContent('王道计')
      expect(result.source).toBe('index')
      expect(result.preciseTotal).toBe(false)
      expect(result.totalMatches).toBe(1)
      expect(result.hits).toHaveLength(1)
      expect(result.hits[0]?.snippet).toContain('王道计')
    } finally {
      unregister()
    }
  })

  it('searchBlockedReason 有值时抛同一句中文，generator 零次拉 next', async () => {
    let pulls = 0
    const unregister = registerReaderContent({
      filePath: '/book/scan.pdf',
      fileFingerprint: '/book/scan.pdf|123',
      searchBlockedReason: '先建立罗盘索引，或手动单页识别',
      getCurrentText: () => '',
      iterateUnits: async function* () {
        pulls += 1
        yield { label: '第 1 页', text: '王道计' }
      },
    })
    try {
      await expect(searchReaderContent('王道计')).rejects.toThrow('先建立罗盘索引，或手动单页识别')
      // 防 OCR 契约：生成器一次都没被拉取，逐页遍历根本没开始
      expect(pulls).toBe(0)
    } finally {
      unregister()
    }
  })

  it('iterateUnits 抛错向上传递为工具错误，不冒充空成功', async () => {
    const unregister = registerReaderContent({
      filePath: '/book/indexed.pdf',
      fileFingerprint: '/book/indexed.pdf|9',
      getCurrentText: () => '',
      iterateUnits: async function* () {
        throw new Error('罗盘索引无法读取章节，请重建索引或手动识别本页')
        yield { label: '永不到达', text: '' }
      },
    })
    try {
      await expect(searchReaderContent('王道计')).rejects.toThrow('罗盘索引无法读取章节')
    } finally {
      unregister()
    }
  })
})
