/** 相对 index.html 的 pdf.js 静态资源根（Vite public → 开发/打包均可用） */
export function pdfjsAssetBaseUrl(): string {
  if (typeof document !== 'undefined' && document.baseURI) {
    return new URL('pdfjs/', document.baseURI).href
  }
  return new URL('pdfjs/', 'http://localhost/').href
}

export function buildPdfjsDocumentAssetOptions() {
  const assetBase = pdfjsAssetBaseUrl()
  return {
    cMapUrl: `${assetBase}cmaps/`,
    cMapPacked: true as const,
    standardFontDataUrl: `${assetBase}standard_fonts/`,
    wasmUrl: `${assetBase}wasm/`,
    iccUrl: `${assetBase}iccs/`,
    useSystemFonts: true as const,
  }
}
