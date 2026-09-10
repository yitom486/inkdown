import { describe, expect, it } from 'vitest'
import { readPdfPageSizes } from './pdf-page-geometry'

const MINIMAL_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n' +
    '4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 72 720 Td (Hello World) Tj ET\nendstream\nendobj\n' +
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n' +
    'trailer\n<< /Root 1 0 R >>\n',
  'latin1',
)

describe('readPdfPageSizes', () => {
  it('真实 MediaBox 尺寸（非写死 612×792：读出来必须对上）', async () => {
    const sizes = await readPdfPageSizes(MINIMAL_PDF, [1])
    expect(sizes.get(1)).toEqual({ width: 612, height: 792 })
  })

  it('越界页跳过', async () => {
    const sizes = await readPdfPageSizes(MINIMAL_PDF, [1, 99])
    expect(sizes.has(99)).toBe(false)
    expect(sizes.get(1)).toEqual({ width: 612, height: 792 })
  })

  it('非法数据返回空表（不抛错，调用方按页停手）', async () => {
    await expect(readPdfPageSizes(Buffer.from('not-a-pdf'), [1])).resolves.toEqual(new Map())
    await expect(readPdfPageSizes(Buffer.alloc(0), [1])).resolves.toEqual(new Map())
  })

  it('空页表直接返回空（不解析）', async () => {
    await expect(readPdfPageSizes(MINIMAL_PDF, [])).resolves.toEqual(new Map())
  })
})
