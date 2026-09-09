import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let tempUserData = ''

vi.mock('electron', () => ({
  app: {
    getPath: () => tempUserData,
  },
}))

import {
  PDF_OCR_TOC_CACHE_VERSION,
  deletePdfOcrTocCache,
  readPdfOcrTocCache,
  writePdfOcrTocCache,
} from './ocr-toc-cache'
import type { PdfOcrTocCache } from '@shared/types/ocr'

function makeCache(): PdfOcrTocCache {
  return {
    fileFingerprint: 'fp-toc-1',
    tocPageRange: [8, 12],
    pageOffset: 12,
    entries: [{ title: '第1章', printedPage: 1, level: 0 }],
    units: [{ label: '第1章', href: '13', level: 0 }],
    createdAt: new Date().toISOString(),
  }
}

describe('ocr-toc-cache', () => {
  beforeEach(async () => {
    tempUserData = await mkdtemp(join(tmpdir(), 'ocr-toc-'))
  })

  afterEach(() => {
    tempUserData = ''
  })

  it('写入打版本戳，同版本可读', async () => {
    await writePdfOcrTocCache(makeCache())
    const cached = await readPdfOcrTocCache('fp-toc-1')
    expect(cached?.extractorVersion).toBe(PDF_OCR_TOC_CACHE_VERSION)
    expect(cached?.entries).toHaveLength(1)
  })

  it('旧版本与缺失文件一律视为过期', async () => {
    // 绕开 service 直写 v1 缓存，模拟 extractor 升级前的脏数据
    const hash = createHash('sha256').update('fp-toc-1').digest('hex').slice(0, 16)
    await mkdir(join(tempUserData, 'ocr-cache'), { recursive: true })
    await writeFile(
      join(tempUserData, 'ocr-cache', `${hash}.json`),
      JSON.stringify({ ...makeCache(), extractorVersion: 1 }),
    )
    expect(await readPdfOcrTocCache('fp-toc-1')).toBeNull()
    expect(await readPdfOcrTocCache('no-such-book')).toBeNull()
  })

  it('删除后读不到', async () => {
    await writePdfOcrTocCache(makeCache())
    await deletePdfOcrTocCache('fp-toc-1')
    expect(await readPdfOcrTocCache('fp-toc-1')).toBeNull()
  })
})
