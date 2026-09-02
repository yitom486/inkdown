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

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `无法下载 OCR 运行时（HTTP ${response.status}）。请确认 Release 已附带 ${OCR_RUNTIME_ARCHIVE}。`,
    )
  }

  const tempDir = join(app.getPath('temp'), 'inkdown-ocr-runtime')
  await mkdir(tempDir, { recursive: true })
  const archivePath = join(tempDir, OCR_RUNTIME_ARCHIVE)

  const buffer = Buffer.from(await response.arrayBuffer())
  await writeFile(archivePath, buffer)
  await installOcrRuntimeFromArchive(archivePath, onProgress)
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
