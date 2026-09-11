/**
 * pdf-inspector OCR 外部运行时 pin（PDFium + ONNX Runtime + PP-OCRv6 Small 模型）。
 * 与 Rust 侧 oar-ocr-v0.7.0 manifest 对齐；哈希为发布时实测/官方 SHA256SUMS。
 * 上游发新版时同步更新此处 + 本地冒烟（win/mac）。
 */

export const INSPECTOR_OCR_REVISION = 'oar-ocr-v0.7.0'

export type InspectorOcrPlatform = 'win32-x64' | 'darwin-arm64' | 'linux-x64'

/** 主进程传入 process.platform/process.arch；渲染端无 Node，不直接读 process */
export function resolveInspectorPlatform(
  platform: string,
  arch: string,
): InspectorOcrPlatform | null {
  if (platform === 'win32' && arch === 'x64') return 'win32-x64'
  if (platform === 'darwin' && arch === 'arm64') return 'darwin-arm64'
  if (platform === 'linux' && arch === 'x64') return 'linux-x64'
  return null
}

export interface InspectorNativeLib {
  url: string
  sha256: string
  /** 压缩包内库文件名（解压后按名查找） */
  libFile: string
}

/** Firecrawl PDFium native-v7988（SHA256 取官方 SHA256SUMS） */
export const INSPECTOR_PDFIUM: Record<InspectorOcrPlatform, InspectorNativeLib> = {
  'win32-x64': {
    url: 'https://github.com/firecrawl/pdfium-rs/releases/download/native-v7988/firecrawl-pdfium-win-x64.tgz',
    sha256: '6f398552d8021a89078f64466557251a204999177287b876be49877eb8750d50',
    libFile: 'pdfium.dll',
  },
  'darwin-arm64': {
    url: 'https://github.com/firecrawl/pdfium-rs/releases/download/native-v7988/firecrawl-pdfium-mac-arm64.tgz',
    sha256: '4168356c2e62ad5e79553e2e9162f5c99949759d90cb83876a50311f0c32b9b3',
    libFile: 'libpdfium.dylib',
  },
  'linux-x64': {
    url: 'https://github.com/firecrawl/pdfium-rs/releases/download/native-v7988/firecrawl-pdfium-linux-x64.tgz',
    sha256: '6248189e07bbc33cdeb31976c539a88614307c8a19f3276dbd018efbe5b4a2a2',
    libFile: 'libpdfium.so',
  },
}

/** ONNX Runtime 1.27.0（SHA256 为发布时实测） */
export const INSPECTOR_ORT: Record<InspectorOcrPlatform, InspectorNativeLib> = {
  'win32-x64': {
    url: 'https://github.com/microsoft/onnxruntime/releases/download/v1.27.0/onnxruntime-win-x64-1.27.0.zip',
    sha256: 'c5c81710938e68079ff1a192b04897faabe4b43830d48f39f27ecd4e16138bfc',
    libFile: 'onnxruntime.dll',
  },
  'darwin-arm64': {
    url: 'https://github.com/microsoft/onnxruntime/releases/download/v1.27.0/onnxruntime-osx-arm64-1.27.0.tgz',
    sha256: '545e81c58152353acb0d1e8bd6ce4b62f830c0961f5b3acfedc790ffd76e477a',
    libFile: 'libonnxruntime.dylib',
  },
  'linux-x64': {
    url: 'https://github.com/microsoft/onnxruntime/releases/download/v1.27.0/onnxruntime-linux-x64-1.27.0.tgz',
    sha256: '547e40a48f1fe73e3f812d7c88a948612c23f896b91e4e2ee1e232d7b468246f',
    libFile: 'libonnxruntime.so',
  },
}

export interface InspectorModelFile {
  url: string
  sha256: string
  size: number
  /** oar ModelStore 识别的文件名，原样存放 */
  file: string
}

/** PP-OCRv6 Small（oar-ocr-v0.7.0 manifest 原样搬运，与 Rust 侧校验一致） */
export const INSPECTOR_MODELS: InspectorModelFile[] = [
  {
    url: 'https://github.com/GreatV/oar-ocr/releases/download/v0.7.0/pp-ocrv6_small_det.onnx',
    sha256: 'd73e0058b7a8086bbd57f3d10b8bcd4ff95363f67e06e2762b5e814fe9c9410e',
    size: 9880512,
    file: 'pp-ocrv6_small_det.onnx',
  },
  {
    url: 'https://github.com/GreatV/oar-ocr/releases/download/v0.7.0/pp-ocrv6_small_rec.onnx',
    sha256: '5435fd747c9e0efe15a96d0b378d5bd157e9492ed8fd80edf08f30d02fa24634',
    size: 21159378,
    file: 'pp-ocrv6_small_rec.onnx',
  },
  {
    url: 'https://github.com/GreatV/oar-ocr/releases/download/v0.7.0/ppocrv6_dict.txt',
    sha256: 'b5f2bfe2bdd9448429e3e82b51c789775d9b42f2403d082b00662eb77e401c5d',
    size: 74947,
    file: 'ppocrv6_dict.txt',
  },
]
