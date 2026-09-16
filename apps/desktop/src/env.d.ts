/// <reference types="vite/client" />

import type { ElectronAPI } from '@inkdown/contracts'

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
