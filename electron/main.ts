import { app, BrowserWindow, Menu } from 'electron'
import { createWindow } from './window/create-window'
import { registerIpcHandlers } from './ipc/register-handlers'
import { disposeAllWorkspaceWatches } from './services/workspace-watcher'

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  disposeAllWorkspaceWatches()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
