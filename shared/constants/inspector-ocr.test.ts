import { describe, expect, it } from 'vitest'
import {
  INSPECTOR_MODELS,
  INSPECTOR_ORT,
  INSPECTOR_PDFIUM,
  type InspectorOcrPlatform,
} from './inspector-ocr'

const SHA256_HEX = /^[0-9a-f]{64}$/

const PLATFORMS: InspectorOcrPlatform[] = ['win32-x64', 'darwin-arm64', 'linux-x64']

describe('inspector-ocr pins', () => {
  it('全部 sha256 必须是 64 位小写 hex（62 位截断一律挡住）', () => {
    for (const platform of PLATFORMS) {
      expect(
        INSPECTOR_PDFIUM[platform].sha256,
        `pdfium ${platform}`,
      ).toMatch(SHA256_HEX)
      expect(INSPECTOR_ORT[platform].sha256, `ort ${platform}`).toMatch(SHA256_HEX)
    }
    for (const model of INSPECTOR_MODELS) {
      expect(model.sha256, model.file).toMatch(SHA256_HEX)
    }
  })

  it('模型 size > 0 且 url 非空', () => {
    for (const model of INSPECTOR_MODELS) {
      expect(model.size, model.file).toBeGreaterThan(0)
      expect(model.url.startsWith('https://'), model.file).toBe(true)
    }
    for (const platform of PLATFORMS) {
      expect(INSPECTOR_PDFIUM[platform].url.startsWith('https://')).toBe(true)
      expect(INSPECTOR_ORT[platform].url.startsWith('https://')).toBe(true)
    }
  })
})
