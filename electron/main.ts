import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { IPC } from '../shared/ipc/channels'
import { createWindow } from './window/create-window'
import { installAppMenu } from './window/app-menu'
import { registerIpcHandlers } from './ipc/register-handlers'
import { initAppUpdater } from './services/app-updater'
import { disposeAllAcp } from './services/acp/acp-client'
import { disposeAllWorkspaceWatches } from './services/workspace-watcher'
import { shutdownOcrWorker } from './services/ocr/ocr-worker'
import { syncManager } from './services/sync/sync-manager'

// 注册应用自定义深度协议 inkdown://
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('inkdown', process.execPath, [path.resolve(process.argv[1] ?? '')])
  }
} else {
  app.setAsDefaultProtocolClient('inkdown')
}

// 开发环境下隔离应用数据目录，避免与已安装的正式版互相冲突锁定或污染数据；若命令行显式传入了 --user-data-dir 则优先遵循
if (!app.isPackaged) {
  const customUserDataArg = process.argv.find((arg) => arg.startsWith('--user-data-dir='))
  if (customUserDataArg) {
    const customDir = customUserDataArg.slice('--user-data-dir='.length).trim()
    if (customDir) {
      app.setPath('userData', customDir)
    }
  } else {
    app.setPath('userData', path.join(app.getPath('appData'), 'inkdown-dev'))
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, commandLine) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
      const deepLink = commandLine.find((arg) => arg.startsWith('inkdown://'))
      if (deepLink) {
        win.webContents.send(IPC.APP_GLOBAL_ACTION, `deep-link:${deepLink}`)
      }
    }
  })
}

app.on('open-url', (event, url) => {
  event.preventDefault()
  const win = BrowserWindow.getAllWindows()[0]
  if (win && !win.isDestroyed()) {
    win.webContents.send(IPC.APP_GLOBAL_ACTION, `deep-link:${url}`)
  }
})

app.whenReady().then(() => {
  installAppMenu()
  registerIpcHandlers()
  initAppUpdater()
  createWindow()
  syncManager.initAutoSync()

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
