import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import {
  OCR_RUNTIME_ARCHIVE,
  OCR_TESSERACT_VERSION,
  ocrRuntimeReleaseAssetUrl,
} from '@shared/constants/ocr-runtime'
import type { createWorker as CreateWorkerFn } from 'tesseract.js'

const execFileAsync = promisify(execFile)
const cjsRequire = createRequire(import.meta.url)

export interface OcrRuntimeManifest {
  tesseractVersion: string
  archive: string
  sha256: string
  createdAt: string
}

function runtimeVersionDir(): string {
  return join(app.getPath('userData'), 'ocr', 'runtime', OCR_TESSERACT_VERSION)
}

function manifestPath(): string {
  return join(runtimeVersionDir(), 'manifest.json')
}

function tesseractPackageJsonPath(root: string): string {
  return join(root, 'node_modules', 'tesseract.js', 'package.json')
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

export function usesBundledDevRuntime(): boolean {
  return !app.isPackaged
}

export async function isOcrRuntimeInstalled(): Promise<boolean> {
  if (usesBundledDevRuntime()) return true
  const root = runtimeVersionDir()
  return (
    (await pathExists(manifestPath())) &&
    (await pathExists(tesseractPackageJsonPath(root)))
  )
}

async function extractTarGz(archivePath: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true })
  await execFileAsync('tar', ['-xzf', archivePath, '-C', destDir])
}

export async function installOcrRuntimeFromArchive(
  archivePath: string,
  onProgress?: (message: string, progress: number) => void,
): Promise<void> {
  const buffer = await readFile(archivePath)
  const sha256 = createHash('sha256').update(buffer).digest('hex')
  const dest = runtimeVersionDir()

  await rm(dest, { recursive: true, force: true })
  onProgress?.('正在解压 OCR 运行时…', 20)
  await extractTarGz(archivePath, dest)

  const manifest: OcrRuntimeManifest = {
    tesseractVersion: OCR_TESSERACT_VERSION,
    archive: OCR_RUNTIME_ARCHIVE,
    sha256,
    createdAt: new Date().toISOString(),
  }
  await writeFile(manifestPath(), JSON.stringify(manifest, null, 2), 'utf8')
  onProgress?.('OCR 运行时已安装', 40)
}

export async function downloadOcrRuntime(
  onProgress?: (message: string, progress: number) => void,
): Promise<void> {
  const url = ocrRuntimeReleaseAssetUrl(app.getVersion())
  onProgress?.('正在下载 OCR 运行时…', 5)

  // 18MB 大文件：超时 + 有限重试，弱网不再一次失败就全盘报错
  const maxAttempts = 3
  let buffer: Buffer | null = null
  let lastCause: unknown = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(120000) })
      if (!response.ok) {
        // 4xx（尤其 404 缺资源）重试无意义，直接失败
        if (response.status >= 400 && response.status < 500) {
          throw new Error(
            `无法下载 OCR 运行时（HTTP ${response.status}）。请确认 Release 已附带 ${OCR_RUNTIME_ARCHIVE}。`,
          )
        }
        throw new Error(`下载 OCR 运行时临时失败（HTTP ${response.status}），正在重试`)
      }
      buffer = Buffer.from(await response.arrayBuffer())
      lastCause = null
      break
    } catch (cause) {
      lastCause = cause
      // 4xx 缺资源重试无意义，直接失败
      if (cause instanceof Error && cause.message.startsWith('无法下载 OCR 运行时')) {
        throw cause
      }
      if (attempt < maxAttempts) {
        onProgress?.(`下载中断，正在重试（${attempt}/${maxAttempts - 1}）…`, 5)
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)))
      }
    }
  }
  if (!buffer) {
    throw new Error(
      `下载 OCR 运行时失败（已重试 ${maxAttempts - 1} 次）：${lastCause instanceof Error ? lastCause.message : '网络异常'}。请检查网络后重试。`,
    )
  }

  // 与 Release 同名的 .manifest.json 比对 SHA256；老版本无 manifest 时放行并告警，
  // 哈希不一致则拒绝安装（防投毒/断点残包）。
  await verifyOcrRuntimeArchive(buffer, url)

  const tempDir = join(app.getPath('temp'), 'inkdown-ocr-runtime')
  await mkdir(tempDir, { recursive: true })
  const archivePath = join(tempDir, OCR_RUNTIME_ARCHIVE)

  await writeFile(archivePath, buffer)
  await installOcrRuntimeFromArchive(archivePath, onProgress)
}

/** 发布 manifest 缺失则放行（兼容老 Release），存在则必须匹配 */
async function verifyOcrRuntimeArchive(buffer: Buffer, assetUrl: string): Promise<void> {
  const manifestUrl = assetUrl.replace(/\.tar\.gz$/, '.manifest.json')
  let manifest: OcrRuntimeManifest | null = null
  try {
    const res = await fetch(manifestUrl, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return
    const json = (await res.json()) as Partial<OcrRuntimeManifest>
    if (!json || typeof json.sha256 !== 'string' || json.sha256.length === 0) return
    manifest = json as OcrRuntimeManifest
  } catch {
    console.warn('[ocr] 运行时 manifest 获取失败，跳过校验')
    return
  }

  const actual = createHash('sha256').update(buffer).digest('hex')
  if (actual !== manifest.sha256) {
    throw new Error(
      `OCR 运行时校验失败（SHA256 不一致，可能下载损坏或被篡改），已拒绝安装。请重试或检查网络环境。`,
    )
  }
}

export async function resolveTesseractRoot(): Promise<string> {
  if (usesBundledDevRuntime()) {
    return join(cjsRequire.resolve('tesseract.js/package.json'), '..')
  }

  if (!(await isOcrRuntimeInstalled())) {
    throw new Error('OCR 运行时未安装，请先在设置中下载')
  }

  return join(runtimeVersionDir(), 'node_modules', 'tesseract.js')
}

export async function loadCreateWorker(): Promise<typeof CreateWorkerFn> {
  const root = await resolveTesseractRoot()
  const req = createRequire(join(root, 'package.json'))
  return req('./src/index.js').createWorker as typeof CreateWorkerFn
}
