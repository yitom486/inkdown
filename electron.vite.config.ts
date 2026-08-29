import { resolve } from 'path'
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
