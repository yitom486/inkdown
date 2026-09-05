import { resolve } from 'path'
import { builtinModules } from 'node:module'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'
import { copyPdfjsAssetsPlugin } from './electron/vite-plugins/copy-pdfjs-assets'

const sharedAlias = {
  '@shared': resolve('shared'),
}

/** file:// 协议下 crossorigin 会导致 JS/CSS 静默加载失败（生产黑屏） */
function removeCrossOriginPlugin(): Plugin {
  return {
    name: 'remove-crossorigin',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(/ crossorigin/g, '')
    },
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: sharedAlias,
    },
    build: {
      lib: {
        entry: resolve('electron/main.ts'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: sharedAlias,
    },
    build: {
      lib: {
        entry: resolve('electron/preload.ts'),
        // 沙盒渲染器只能加载 CJS preload（ESM import 会报 Cannot use import statement）
        formats: ['cjs'],
      },
      rollupOptions: {
        // 沙盒 preload 只能 require 沙盒暴露的模块：electron 与 node 内建保持外部，
        // 其余一律打进包（CJS 下 externalize 插件曾把 electron/index.js 内联进来，
        // 导致 child_process 在沙盒里炸掉）。
        external: ['electron', ...builtinModules, ...builtinModules.map((name) => `node:${name}`)],
        output: {
          entryFileNames: 'preload.cjs',
        },
      },
    },
  },
  renderer: {
    root: resolve('src'),
    base: './',
    build: {
      modulePreload: { polyfill: false },
      rollupOptions: {
        input: resolve('src/index.html'),
      },
    },
    resolve: {
      alias: {
        '@': resolve('src'),
        ...sharedAlias,
      },
    },
    plugins: [react(), tailwindcss(), removeCrossOriginPlugin(), copyPdfjsAssetsPlugin()],
  },
})
