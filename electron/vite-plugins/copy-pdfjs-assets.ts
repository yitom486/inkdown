import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

const PDFJS_ASSET_DIRS = ['cmaps', 'standard_fonts', 'wasm', 'iccs'] as const

/**
 * 把 pdfjs-dist 的 CMap / 标准字体等拷到 src/public/pdfjs，
 * 供开发服务器与打包产物以相对路径加载（中文 CID 字体刚需）。
 */
export function copyPdfjsAssetsPlugin(): Plugin {
  const copy = () => {
    const pkgRoot = resolve('node_modules/pdfjs-dist')
    const destRoot = resolve('src/public/pdfjs')

    if (!existsSync(pkgRoot)) {
      console.warn('[copy-pdfjs-assets] pdfjs-dist not found, skip')
      return
    }

    mkdirSync(destRoot, { recursive: true })

    for (const dir of PDFJS_ASSET_DIRS) {
      const from = resolve(pkgRoot, dir)
      const to = resolve(destRoot, dir)
      if (!existsSync(from)) continue
      rmSync(to, { recursive: true, force: true })
      mkdirSync(to, { recursive: true })
      cpSync(from, to, { recursive: true })
    }
  }

  return {
    name: 'copy-pdfjs-assets',
    buildStart: copy,
    configureServer: copy,
  }
}
