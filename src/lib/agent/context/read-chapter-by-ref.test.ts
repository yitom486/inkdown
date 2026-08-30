import { describe, expect, it, afterEach } from 'vitest'
import { registerReaderContent } from './reader-content-registry'
import { readChapterByRef } from './read-chapter-by-ref'
import { useReaderNavigationStore } from '@/stores/reader-navigation-store'
import { EMPTY_READER_NAV } from '@/lib/reader/reader-navigation-sync'

afterEach(() => {
  useReaderNavigationStore.setState({
    ready: false,
    filePath: null,
    format: null,
    units: [],
    nav: EMPTY_READER_NAV,
    navIntent: null,
  })
})

describe('readChapterByRef', () => {
  it('按 flatIndex 读取', async () => {
    useReaderNavigationStore.setState({
      ready: true,
      filePath: '/a.epub',
      format: 'epub',
      units: [
        { label: '第一章', href: '1', level: 0 },
        { label: '第二章', href: '2', level: 0 },
      ],
    })

    const dispose = registerReaderContent({
      filePath: '/a.epub',
      getCurrentText: () => '当前',
      getUnitByIndex: async (index) => {
        const texts = ['一章正文', '二章正文']
        return { label: ['第一章', '第二章'][index]!, text: texts[index]! }
      },
    })

    const result = await readChapterByRef({ flatIndex: 1 })
    expect(result).toMatchObject({
      index: 1,
      label: '第二章',
      text: '二章正文',
      matchedBy: 'flatIndex',
    })
    dispose()
  })

  it('按标题包含匹配', async () => {
    useReaderNavigationStore.setState({
      ready: true,
      filePath: '/a.epub',
      format: 'epub',
      units: [
        { label: '导言', href: '0', level: 0 },
        { label: '第三章 共天下', href: '3', level: 0 },
      ],
    })

    const dispose = registerReaderContent({
      filePath: '/a.epub',
      getCurrentText: () => '',
      getUnitByIndex: async (index) => {
        if (index !== 1) return null
        return { label: '第三章 共天下', text: '王与马共天下' }
      },
    })

    const result = await readChapterByRef({ title: '共天下' })
    expect(result.matchedBy).toBe('title-includes')
    expect(result.text).toContain('王与马')
    dispose()
  })

  it('越界 flatIndex 报错', async () => {
    useReaderNavigationStore.setState({
      ready: true,
      filePath: '/a.epub',
      format: 'epub',
      units: [{ label: '仅一章', href: '1', level: 0 }],
    })
    const dispose = registerReaderContent({
      filePath: '/a.epub',
      getCurrentText: () => 'x',
      getUnitByIndex: async () => ({ label: '仅一章', text: 'x' }),
    })
    await expect(readChapterByRef({ flatIndex: 9 })).rejects.toThrow('越界')
    dispose()
  })
})
