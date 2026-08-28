/// <reference types="vite/client" />

import type { ElectronAPI } from '@shared/electron-api.types'

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
