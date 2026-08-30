import { describe, expect, it, vi } from 'vitest'
import { loadPdfOutlineUnits } from '@/lib/reader/pdf-outline'
import type { PDFDocumentProxy } from 'pdfjs-dist'

function createPdfMock(options: {
  numPages: number
  outline?: Array<{ title: string; dest: unknown[] | null; items?: unknown[] }> | null
  pageIndex?: number
}): PDFDocumentProxy {
  const { numPages, outline = null, pageIndex = 0 } = options

  return {
    numPages,
    getOutline: vi.fn(async () => outline),
    getDestination: vi.fn(async (name: string) => (name === 'chapter1' ? ['ref'] : null)),
    getPageIndex: vi.fn(async () => pageIndex),
  } as unknown as PDFDocumentProxy
}

describe('loadPdfOutlineUnits', () => {
  it('无 outline 时按页生成占位单元', async () => {
    const pdf = createPdfMock({ numPages: 3, outline: null })
    const units = await loadPdfOutlineUnits(pdf)

    expect(units).toEqual([
      { label: '第 1 页', href: '1', level: 0 },
      { label: '第 2 页', href: '2', level: 0 },
      { label: '第 3 页', href: '3', level: 0 },
    ])
  })

  it('解析 outline 为 ReaderUnit 列表', async () => {
    const pdf = createPdfMock({
      numPages: 10,
      outline: [
        { title: ' 前言 ', dest: ['ref'] },
        {
          title: '第一章',
          dest: ['ref'],
          items: [{ title: '1.1 节', dest: ['ref'] }],
        },
      ],
      pageIndex: 4,
    })

    const units = await loadPdfOutlineUnits(pdf)

    expect(units).toEqual([
      { label: '前言', href: '5', level: 0 },
      { label: '第一章', href: '5', level: 0 },
      { label: '1.1 节', href: '5', level: 1 },
    ])
  })

  it('outline 解析结果为空时回退到按页单元', async () => {
    const pdf = createPdfMock({
      numPages: 2,
      outline: [{ title: '无效', dest: null }],
    })

    const units = await loadPdfOutlineUnits(pdf)

    expect(units).toEqual([
      { label: '第 1 页', href: '1', level: 0 },
      { label: '第 2 页', href: '2', level: 0 },
    ])
  })
})
