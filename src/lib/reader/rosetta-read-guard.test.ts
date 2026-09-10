import { describe, expect, it } from 'vitest'
import { rosettaPageMissingError } from './rosetta-read-guard'

describe('rosettaPageMissingError', () => {
  it('文案含页码与两条出路，不含技术黑话', () => {
    const error = rosettaPageMissingError(36)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('第 36 页')
    expect(error.message).toContain('罗盘无正文')
    expect(error.message).toContain('重建索引')
    expect(error.message).toContain('手动识别本页')
    expect(error.message).not.toMatch(/readPageText|OCR|inspector/i)
  })
})
