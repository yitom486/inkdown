import { describe, it, expect } from 'vitest'
import { mergeReadingProgress, type ReadingProgressSnapshot } from './progress-merger'

describe('progress-merger', () => {
  it('正确合并各格式阅读进度并以最新时间戳胜出', () => {
    const local: ReadingProgressSnapshot = {
      pdfByFile: {
        'book1.pdf': { pageNum: 10, updatedAt: 1000 },
        'book2.pdf': { pageNum: 5, updatedAt: 5000 },
      },
      epubByFile: {
        'book1.epub': { cfi: 'epubcfi(/6/2[chap1]!)', updatedAt: 1000 },
      },
      webByUrl: {
        'https://doc.test/page1': { scrollRatio: 0.2, updatedAt: 3000 },
      },
    }

    const remote: ReadingProgressSnapshot = {
      pdfByFile: {
        'book1.pdf': { pageNum: 15, updatedAt: 2000 }, // 远端更新
        'book3.pdf': { pageNum: 1, updatedAt: 1000 },  // 远端独有
      },
      epubByFile: {
        'book1.epub': { cfi: 'epubcfi(/6/4[chap2]!)', updatedAt: 500 }, // 本地更新
      },
      webByUrl: {
        'https://doc.test/page1': { scrollRatio: 0.8, updatedAt: 4000 }, // 远端更新
      },
    }

    const { merged, updatedCount } = mergeReadingProgress(local, remote)

    // PDF book1 取远端 (15), book2 取本地 (5), book3 取远端 (1)
    expect(merged.pdfByFile?.['book1.pdf']?.pageNum).toBe(15)
    expect(merged.pdfByFile?.['book2.pdf']?.pageNum).toBe(5)
    expect(merged.pdfByFile?.['book3.pdf']?.pageNum).toBe(1)

    // EPUB book1 本地更新胜出
    expect(merged.epubByFile?.['book1.epub']?.cfi).toBe('epubcfi(/6/2[chap1]!)')

    // Web 网页滚动取远端
    expect(merged.webByUrl?.['https://doc.test/page1']?.scrollRatio).toBe(0.8)

    expect(updatedCount).toBe(3) // pdf book1, pdf book3, web page1
  })
})
