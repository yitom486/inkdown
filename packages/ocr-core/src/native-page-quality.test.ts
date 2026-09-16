import { describe, expect, it } from 'vitest'
import {
  assessNativePageText,
  NATIVE_PAGE_QUALITY_OK,
  NATIVE_PAGE_QUALITY_SUGGEST_OCR,
} from './native-page-quality'

describe('assessNativePageText', () => {
  it('正常正文与短标题视为 ok', () => {
    expect(assessNativePageText('流水线技术通过重叠执行指令提升吞吐率')).toBe(
      NATIVE_PAGE_QUALITY_OK,
    )
    expect(assessNativePageText('第 1 章')).toBe(NATIVE_PAGE_QUALITY_OK)
    expect(assessNativePageText('图 1-1 数据通路')).toBe(NATIVE_PAGE_QUALITY_OK)
  })

  it('空页与空白视为建议 OCR', () => {
    expect(assessNativePageText('')).toBe(NATIVE_PAGE_QUALITY_SUGGEST_OCR)
    expect(assessNativePageText('  \n\t  ')).toBe(NATIVE_PAGE_QUALITY_SUGGEST_OCR)
  })

  it('替换字符与 cid 乱码视为建议 OCR', () => {
    expect(assessNativePageText(`开头${'\uFFFD'.repeat(20)}结尾`)).toBe(
      NATIVE_PAGE_QUALITY_SUGGEST_OCR,
    )
    expect(assessNativePageText('(cid:12)(cid:13)(cid:14)(cid:15)')).toBe(
      NATIVE_PAGE_QUALITY_SUGGEST_OCR,
    )
  })
})
