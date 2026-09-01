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

export async function readPdfOcrTocCache(
  fileFingerprint: string,
): Promise<PdfOcrTocCache | null> {
  try {
    const raw = await readFile(cacheFilePath(fileFingerprint), 'utf8')
    return JSON.parse(raw) as PdfOcrTocCache
  } catch {
    return null
  }
}

export async function writePdfOcrTocCache(cache: PdfOcrTocCache): Promise<void> {
  await mkdir(ocrCacheRoot(), { recursive: true })
  await writeFile(cacheFilePath(cache.fileFingerprint), JSON.stringify(cache, null, 2), 'utf8')
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
