import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const sharedAlias = {
  '@shared': resolve('shared'),
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
    build: {
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
    plugins: [react(), tailwindcss()],
  },
})
