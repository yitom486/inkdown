import { beforeEach, describe, expect, it } from 'vitest'
import { buildEpubFileFingerprint } from '@/lib/reader/epub-locations-cache'

describe('epub-locations-cache', () => {
  it('同路径与大小生成相同 fingerprint', () => {
    const a = buildEpubFileFingerprint('D:\\book\\a.epub', 1024)
    const b = buildEpubFileFingerprint('D:\\book\\a.epub', 1024)
    expect(a).toBe(b)
  })

  it('文件大小变化时 fingerprint 不同', () => {
    const a = buildEpubFileFingerprint('D:\\book\\a.epub', 1024)
    const b = buildEpubFileFingerprint('D:\\book\\a.epub', 2048)
    expect(a).not.toBe(b)
  })
})
