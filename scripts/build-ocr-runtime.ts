/**
 * 打包 OCR 运行时 tar.gz，附到 GitHub Release。
 * 用法：bun run build:ocr-runtime
 */
import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { promisify } from 'node:util'
import {
  OCR_RUNTIME_ARCHIVE,
  OCR_RUNTIME_PACKAGES,
  OCR_TESSERACT_VERSION,
} from '../shared/constants/ocr-runtime'

const execFileAsync = promisify(execFile)
const ROOT = join(import.meta.dirname, '..')
const cjsRequire = createRequire(join(ROOT, 'package.json'))

async function main(): Promise<void> {
  const staging = join(ROOT, 'release', 'ocr-runtime-staging')
  const nodeModules = join(staging, 'node_modules')
  await rm(staging, { recursive: true, force: true })
  await mkdir(nodeModules, { recursive: true })

  for (const pkg of OCR_RUNTIME_PACKAGES) {
    const pkgJson = cjsRequire.resolve(`${pkg}/package.json`)
    const src = join(pkgJson, '..')
    const dest = join(nodeModules, pkg)
    await cp(src, dest, { recursive: true })
    console.info(`[ocr-runtime] copied ${pkg}`)
  }

  const archivePath = join(ROOT, 'release', OCR_RUNTIME_ARCHIVE)
  await rm(archivePath, { force: true })
  await execFileAsync('tar', ['-czf', archivePath, '-C', staging, '.'])

  const buffer = await readFile(archivePath)
  const sha256 = createHash('sha256').update(buffer).digest('hex')
  const manifest = {
    tesseractVersion: OCR_TESSERACT_VERSION,
    archive: OCR_RUNTIME_ARCHIVE,
    sha256,
    createdAt: new Date().toISOString(),
  }
  await writeFile(
    join(ROOT, 'release', OCR_RUNTIME_ARCHIVE.replace('.tar.gz', '.manifest.json')),
    JSON.stringify(manifest, null, 2),
    'utf8',
  )

  const sizeMb = (buffer.length / (1024 * 1024)).toFixed(1)
  console.info(`[ocr-runtime] wrote ${archivePath} (${sizeMb} MB, sha256=${sha256.slice(0, 12)}…)`)
}

void main().catch((cause) => {
  console.error(cause)
  process.exit(1)
})
