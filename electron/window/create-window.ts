import { BrowserWindow, dialog, nativeImage } from 'electron'
import { join } from 'path'
import { IPC } from '@shared/ipc/channels'
import { APP_TITLE } from '@shared/constants/app'
import { resolveAppIconPath } from '../services/app-paths'
import { shouldLogRendererConsole } from '../services/runtime-state'
import { createWindowCloseController } from './window-close'
import {
  getWindowSessionByWebContents,
  registerWindowSession,
  unregisterWindowSession,
  type WindowSession,
} from './window-session'

function createWindowCloseHandlers(session: WindowSession) {
  return createWindowCloseController({
    getMainWindow: () => (session.window.isDestroyed() ? null : session.window),
    getAllowClose: () => session.allowClose,
    setAllowClose: (value) => {
      session.allowClose = value
    },
    getDocumentDirty: () => session.documentDirty,
    getRendererHealth: () => session.rendererHealth,
    onRequestRendererClose: (win) => {
      win.webContents.send(IPC.APP_REQUEST_CLOSE)
    },
  })
}

export function createWindow(options: { fresh?: boolean } = {}): void {
  const iconPath = resolveAppIconPath()
  const windowIcon = iconPath ? nativeImage.createFromPath(iconPath) : undefined

  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#1e1e1e',
    title: APP_TITLE,
    icon: windowIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  const session: WindowSession = {
    window,
    allowClose: false,
    documentDirty: false,
    rendererHealth: 'ok',
    closeController: null as unknown as WindowSession['closeController'],
    isFresh: options.fresh ?? false,
  }
  session.closeController = createWindowCloseHandlers(session)
  registerWindowSession(session)

  window.on('ready-to-show', () => {
    window.setMenu(null)
    window.setMenuBarVisibility(false)
    window.show()
    if (options.fresh) {
      window.focus()
    }
  })

  window.webContents.on('render-process-gone', (_event, details) => {
    console.error('[render-process-gone]', details.reason, details.exitCode)
    session.rendererHealth = 'crashed'
    session.closeController.clearPendingCloseTimeout()

    if (window.isDestroyed()) return

    void dialog
      .showMessageBox(window, {
        type: 'error',
        title: '界面进程异常',
        message: '编辑器渲染进程已崩溃或异常退出',
        detail: `原因：${details.reason}（exitCode ${details.exitCode}）\n\n可尝试重新加载；若反复出现，请用 Ctrl+Shift+I 查看 Console，或在 帮助 → 错误日志 中查看记录。`,
        buttons: ['重新加载', '关闭窗口'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (window.isDestroyed()) return
        if (response === 0) {
          session.rendererHealth = 'ok'
          window.reload()
          return
        }
        session.closeController.forceCloseWindow(window)
      })
  })

  window.webContents.on('did-finish-load', () => {
    session.rendererHealth = 'ok'
  })

  window.webContents.on('responsive', () => {
    session.rendererHealth = 'ok'
    console.info('[renderer-responsive] 渲染进程已恢复响应')
  })

  window.webContents.on('unresponsive', () => {
    session.rendererHealth = 'unresponsive'
    console.error('[renderer-unresponsive] 渲染进程无响应，可能正在处理大文件或发生死循环')
  })

  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      window.webContents.toggleDevTools()
      event.preventDefault()
      return
    }

    const mod = input.control || input.meta
    if (mod && !input.shift && !input.alt) {
      const key = input.key.toLowerCase()
      const code = input.code

      if (key === 'p' || code === 'KeyP') {
        event.preventDefault()
        window.webContents.send(IPC.APP_GLOBAL_ACTION, 'quick-open')
        return
      }

      if (key === 'f' || code === 'KeyF') {
        event.preventDefault()
        window.webContents.send(IPC.APP_GLOBAL_ACTION, 'find')
        return
      }

      if (key === 'h' || code === 'KeyH') {
        event.preventDefault()
        window.webContents.send(IPC.APP_GLOBAL_ACTION, 'replace')
        return
      }
    }
  })

  window.on('close', (event) => {
    session.closeController.handleWindowClose(event)
  })

  window.on('closed', () => {
    session.closeController.clearPendingCloseTimeout()
    unregisterWindowSession(window)
  })

  window.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('[preload-error]', preloadPath, error)
  })

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[did-fail-load]', errorCode, errorDescription, validatedURL)
  })

  window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (shouldLogRendererConsole(level, message)) {
      console.error('[renderer]', message, `(${sourceId}:${line})`)
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

export function getWindowInitByWebContents(sender: Electron.WebContents): { isFreshWindow: boolean } {
  const session = getWindowSessionByWebContents(sender)
  return { isFreshWindow: session?.isFresh ?? false }
}
