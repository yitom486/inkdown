import { app, BrowserWindow } from 'electron'
import { createWindow } from './window/create-window'
import { installAppMenu } from './window/app-menu'
import { registerIpcHandlers } from './ipc/register-handlers'
import { initAppUpdater } from './services/app-updater'
import { disposeAllAcp } from './services/acp/acp-client'
import { disposeAllWorkspaceWatches } from './services/workspace-watcher'
import { shutdownOcrWorker } from './services/ocr/ocr-worker'

app.whenReady().then(() => {
  installAppMenu()
  registerIpcHandlers()
  initAppUpdater()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  disposeAllAcp()
  void shutdownOcrWorker()
})

app.on('window-all-closed', () => {
  disposeAllWorkspaceWatches()
  disposeAllAcp()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
