import { app, BrowserWindow, Menu } from 'electron'
import { createWindow } from './window/create-window'
import { registerIpcHandlers } from './ipc/register-handlers'
import { initAppUpdater } from './services/app-updater'
import { disposeAllAcp } from './services/acp/acp-client'
import { disposeAllWorkspaceWatches } from './services/workspace-watcher'
import { shutdownOcrWorker } from './services/ocr/ocr-worker'

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  registerIpcHandlers()
  initAppUpdater()
  createWindow()

  // macOS：关光窗口后进程仍在；Dock 再点图标时若无窗则重开
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  disposeAllAcp()
  // OCR worker 停机是异步的，不等待以免卡住退出
  void shutdownOcrWorker()
})

app.on('window-all-closed', () => {
  disposeAllWorkspaceWatches()
  // Mac 关窗不一定走 before-quit，这里也要停 ACP，避免后台子进程残留
  disposeAllAcp()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
