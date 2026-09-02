/** 与 package.json devDependencies 中 tesseract.js 版本对齐 */
export const OCR_TESSERACT_VERSION = '7.0.0'

export const OCR_RUNTIME_ARCHIVE = `ocr-runtime-${OCR_TESSERACT_VERSION}.tar.gz`

export const OCR_RUNTIME_REPO = 'yitom486/inkdown'

/** 发布包附带的 OCR 运行时资源名（全平台通用 tar.gz） */
export function ocrRuntimeReleaseAssetUrl(appVersion: string): string {
  return `https://github.com/${OCR_RUNTIME_REPO}/releases/download/v${appVersion}/${OCR_RUNTIME_ARCHIVE}`
}

/** tesseract.js 运行时所需 npm 包（复制到 userData 离线目录） */
export const OCR_RUNTIME_PACKAGES = [
  'tesseract.js',
  'tesseract.js-core',
  'bmp-js',
  'idb-keyval',
  'is-url',
  'node-fetch',
  'opencollective-postinstall',
  'regenerator-runtime',
  'tr46',
  'wasm-feature-detect',
  'webidl-conversions',
  'whatwg-url',
  'zlibjs',
] as const
