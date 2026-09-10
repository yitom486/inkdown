import { describe, expect, it } from 'vitest'
import { resolvePdfAgentSearchBlock } from './pdf-agent-search-gate'

describe('resolvePdfAgentSearchBlock', () => {
  it('扫描未入库拦截', () => {
    expect(
      resolvePdfAgentSearchBlock({ isScannedPdf: true, isMixedPdf: false, indexed: false }),
    ).toBe('先建立罗盘索引，或手动单页识别')
  })

  it('混合未入库拦截', () => {
    expect(
      resolvePdfAgentSearchBlock({ isScannedPdf: false, isMixedPdf: true, indexed: false }),
    ).toBe('先建立罗盘索引，或手动单页识别')
  })

  it('扫描已入库放行', () => {
    expect(
      resolvePdfAgentSearchBlock({ isScannedPdf: true, isMixedPdf: false, indexed: true }),
    ).toBeNull()
  })

  it('文字版未入库放行', () => {
    expect(
      resolvePdfAgentSearchBlock({ isScannedPdf: false, isMixedPdf: false, indexed: false }),
    ).toBeNull()
  })

  it('EPUB 形态（两 flag 都 false）放行', () => {
    expect(
      resolvePdfAgentSearchBlock({ isScannedPdf: false, isMixedPdf: false, indexed: true }),
    ).toBeNull()
  })
})
