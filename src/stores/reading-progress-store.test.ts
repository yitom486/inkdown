import { beforeEach, describe, expect, it } from 'vitest'
import { useReadingProgressStore } from '@/stores/reading-progress-store'

describe('reading-progress-store', () => {
  beforeEach(() => {
    useReadingProgressStore.setState({
      epubByFile: {},
      epubLocationsByFile: {},
      mobiByFile: {},
      pdfByFile: {},
    })
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

  it('按文件路径保存与读取 MOBI 章节进度', () => {
    const path = 'D:\\book\\sample.mobi'
    useReadingProgressStore.getState().saveMobiProgress(path, { chapterId: 'chapter-3' })

    const saved = useReadingProgressStore.getState().getMobiProgress(path)
    expect(saved?.chapterId).toBe('chapter-3')
  })

  it('按文件路径保存与读取 PDF 页码进度', () => {
    const path = 'D:\\book\\sample.pdf'
    useReadingProgressStore.getState().savePdfProgress(path, { pageNum: 42 })

    const saved = useReadingProgressStore.getState().getPdfProgress(path)
    expect(saved?.pageNum).toBe(42)
  })

  it('三种格式进度互不覆盖', () => {
    const epub = 'D:\\book\\a.epub'
    const mobi = 'D:\\book\\a.mobi'
    const pdf = 'D:\\book\\a.pdf'

    useReadingProgressStore.getState().saveEpubProgress(epub, { cfi: 'epubcfi(/6/4)' })
    useReadingProgressStore.getState().saveMobiProgress(mobi, { chapterId: 'ch-2' })
    useReadingProgressStore.getState().savePdfProgress(pdf, { pageNum: 9 })

    expect(useReadingProgressStore.getState().getEpubProgress(epub)?.cfi).toBe('epubcfi(/6/4)')
    expect(useReadingProgressStore.getState().getMobiProgress(mobi)?.chapterId).toBe('ch-2')
    expect(useReadingProgressStore.getState().getPdfProgress(pdf)?.pageNum).toBe(9)
  })

  it('可分别清除 MOBI / PDF 进度', () => {
    const mobi = 'D:\\book\\sample.mobi'
    const pdf = 'D:\\book\\sample.pdf'
    useReadingProgressStore.getState().saveMobiProgress(mobi, { chapterId: 'ch-1' })
    useReadingProgressStore.getState().savePdfProgress(pdf, { pageNum: 3 })

    useReadingProgressStore.getState().clearMobiProgress(mobi)
    useReadingProgressStore.getState().clearPdfProgress(pdf)

    expect(useReadingProgressStore.getState().getMobiProgress(mobi)).toBeUndefined()
    expect(useReadingProgressStore.getState().getPdfProgress(pdf)).toBeUndefined()
  })

  it('空路径或非法页码不会写入进度', () => {
    useReadingProgressStore.getState().saveMobiProgress('  ', { chapterId: 'ch-1' })
    useReadingProgressStore.getState().savePdfProgress('D:\\book\\x.pdf', { pageNum: 0 })

    expect(Object.keys(useReadingProgressStore.getState().mobiByFile)).toHaveLength(0)
    expect(useReadingProgressStore.getState().getPdfProgress('D:\\book\\x.pdf')).toBeUndefined()
  })
})

