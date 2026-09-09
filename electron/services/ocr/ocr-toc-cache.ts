import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import type { PdfOcrTocCache } from '@shared/types/ocr'

function ocrCacheRoot(): string {
  return join(app.getPath('userData'), 'ocr-cache')
}

function cacheFilePath(fileFingerprint: string): string {
  const hash = createHash('sha256').update(fileFingerprint).digest('hex').slice(0, 16)
  return join(ocrCacheRoot(), `${hash}.json`)
}

/** 目录缓存版本；提取规则/识别清晰度变更时 +1，旧缓存自动失效（v7：AI 层级归一 0-based + 证据来源） */
export const PDF_OCR_TOC_CACHE_VERSION = 7

export async function readPdfOcrTocCache(
  fileFingerprint: string,
): Promise<PdfOcrTocCache | null> {
  try {
    const raw = await readFile(cacheFilePath(fileFingerprint), 'utf8')
    const parsed = JSON.parse(raw) as PdfOcrTocCache
    // 版本不符（旧提取器的水印条目等）视为过期，调用方走重新识别
    if (parsed.extractorVersion !== PDF_OCR_TOC_CACHE_VERSION) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export async function writePdfOcrTocCache(cache: PdfOcrTocCache): Promise<void> {
  await mkdir(ocrCacheRoot(), { recursive: true })
  const stamped: PdfOcrTocCache = { ...cache, extractorVersion: PDF_OCR_TOC_CACHE_VERSION }
  await writeFile(cacheFilePath(cache.fileFingerprint), JSON.stringify(stamped, null, 2), 'utf8')
}

export async function deletePdfOcrTocCache(fileFingerprint: string): Promise<void> {
  try {
    const { unlink } = await import('node:fs/promises')
    await unlink(cacheFilePath(fileFingerprint))
  } catch {
    // ignore missing
  }
}

export async function clearAllPdfOcrCaches(): Promise<void> {
  try {
    await rm(ocrCacheRoot(), { recursive: true, force: true })
  } catch {
    // ignore missing
  }
}
