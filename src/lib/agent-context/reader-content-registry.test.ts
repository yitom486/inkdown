import { describe, expect, it } from 'vitest'
import {
  READER_TEXT_MAX_CHARS,
  normalizeReaderText,
  readCurrentDocumentText,
  readViewportText,
  registerReaderContent,
} from './reader-content-registry'

describe('normalizeReaderText', () => {
  it('折叠多余空行与行尾空格', () => {
    expect(normalizeReaderText('  第一段  \n\n\n\n第二段\t\n')).toBe('第一段\n\n第二段')
  })

  it('超长时截断并标注', () => {
    const text = normalizeReaderText('字'.repeat(READER_TEXT_MAX_CHARS + 100))
    expect(text).toContain('已截断')
    expect(text.length).toBeLessThan(READER_TEXT_MAX_CHARS + 100)
  })
})

describe('readCurrentDocumentText', () => {
  it('没有 provider 时报错而不是返回空串', async () => {
    await expect(readCurrentDocumentText()).rejects.toThrow('没有打开的文档')
  })

  it('返回注册方提供的正文，注销后失效', async () => {
    const dispose = registerReaderContent({
      filePath: '/tmp/a.epub',
      getCurrentText: () => '  正文  ',
    })
    await expect(readCurrentDocumentText()).resolves.toBe('正文')
    dispose()
    await expect(readCurrentDocumentText()).rejects.toThrow('没有打开的文档')
  })

  it('文件已切换时拒绝返回上一本书的内容', async () => {
    const dispose = registerReaderContent({
      filePath: '/tmp/a.epub',
      getCurrentText: () => 'A',
    })
    await expect(readCurrentDocumentText('/tmp/b.epub')).rejects.toThrow('文档刚刚切换')
    dispose()
  })
})

describe('readViewportText', () => {
  it('未实现 getViewportText 时明确报错', async () => {
    const dispose = registerReaderContent({
      filePath: '/tmp/a.epub',
      getCurrentText: () => '整章',
    })
    await expect(readViewportText()).rejects.toThrow('不支持视口')
    dispose()
  })

  it('返回视口文本并截断', async () => {
    const dispose = registerReaderContent({
      filePath: '/tmp/a.epub',
      getCurrentText: () => '整章',
      getViewportText: () => '  视口可见  ',
    })
    await expect(readViewportText()).resolves.toBe('视口可见')
    dispose()
  })
})
