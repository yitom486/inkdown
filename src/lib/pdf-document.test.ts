import { describe, expect, it } from 'vitest'
import { buildPdfjsDocumentAssetOptions, pdfjsAssetBaseUrl } from '@/lib/pdf-document-assets'

describe('pdfjs document assets', () => {
  it('points at the pdfjs/ public asset root with trailing slash', () => {
    const base = pdfjsAssetBaseUrl()
    expect(base.endsWith('pdfjs/')).toBe(true)
  })

  it('includes cMapUrl required for Adobe-GB1 CJK fonts', () => {
    const opts = buildPdfjsDocumentAssetOptions()
    expect(opts.cMapUrl).toMatch(/pdfjs\/cmaps\/$/)
    expect(opts.cMapPacked).toBe(true)
    expect(opts.standardFontDataUrl).toMatch(/pdfjs\/standard_fonts\/$/)
    expect(opts.useSystemFonts).toBe(true)
  })
})
