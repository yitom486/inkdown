import { beforeEach, describe, expect, it } from 'vitest'
import { useReadingProgressStore } from '@/stores/reading-progress-store'

describe('reading-progress-store', () => {
  beforeEach(() => {
    useReadingProgressStore.setState({ epubByFile: {}, epubLocationsByFile: {} })
  })

  it('按文件路径保存与读取 EPUB 进度', () => {
    const path = 'D:\\book\\sample.epub'
    useReadingProgressStore.getState().saveEpubProgress(path, {
      cfi: 'epubcfi(/6/4!/4/2/1:0)',
      href: 'chapter1.xhtml',
      percentage: 0.12,
    })

    const saved = useReadingProgressStore.getState().getEpubProgress(path)
    expect(saved?.cfi).toBe('epubcfi(/6/4!/4/2/1:0)')
    expect(saved?.href).toBe('chapter1.xhtml')
    expect(saved?.percentage).toBe(0.12)
    expect(saved?.updatedAt).toBeTypeOf('number')
  })

  it('可清除单本书进度', () => {
    const path = 'D:\\book\\sample.epub'
    useReadingProgressStore.getState().saveEpubProgress(path, { cfi: 'epubcfi(/6/4)' })
    useReadingProgressStore.getState().clearEpubProgress(path)
    expect(useReadingProgressStore.getState().getEpubProgress(path)).toBeUndefined()
  })

  it('可缓存 EPUB locations 索引', () => {
    const path = 'D:\\book\\sample.epub'
    useReadingProgressStore.getState().saveEpubLocations(path, {
      fingerprint: 'fp-1',
      chunkSize: 800,
      locationsJson: '["epubcfi(/6/4)"]',
    })

    const cached = useReadingProgressStore.getState().getEpubLocations(path)
    expect(cached?.fingerprint).toBe('fp-1')
    expect(cached?.locationsJson).toContain('epubcfi')
  })
})
