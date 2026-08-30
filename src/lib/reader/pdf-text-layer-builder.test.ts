// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { registerPdfJsGlobal } from './pdf-text-layer-builder'

describe('registerPdfJsGlobal', () => {
  it('在加载 pdf_viewer 前注册 PDF.js 核心模块', () => {
    const target: NonNullable<Parameters<typeof registerPdfJsGlobal>[0]> = {}

    registerPdfJsGlobal(target)

    expect(target.pdfjsLib).toBeDefined()
    expect(target.pdfjsLib?.getDocument).toBeTypeOf('function')
  })

  it('不覆盖宿主已经注册的 PDF.js 模块', () => {
    const existing = { getDocument: () => undefined }
    const target = { pdfjsLib: existing } as unknown as NonNullable<
      Parameters<typeof registerPdfJsGlobal>[0]
    >

    registerPdfJsGlobal(target)

    expect(target.pdfjsLib).toBe(existing)
  })
})
