import { BrowserWindow, dialog } from 'electron'
import {
  CLOSE_RENDERER_RESPONSE_TIMEOUT_MS,
  isRendererAvailable,
  resolveCloseInterceptAction,
  type RendererHealth,
} from './close-gate'

export interface WindowCloseControllerOptions {
  getMainWindow: () => BrowserWindow | null
  getAllowClose: () => boolean
  setAllowClose: (value: boolean) => void
  getDocumentDirty: () => boolean
  getRendererHealth: () => RendererHealth
  onRequestRendererClose: (win: BrowserWindow) => void
}

export type WindowCloseController = ReturnType<typeof createWindowCloseController>

export function createWindowCloseController(options: WindowCloseControllerOptions) {
  let pendingCloseTimeout: ReturnType<typeof setTimeout> | null = null

  function clearPendingCloseTimeout(): void {
    if (pendingCloseTimeout) {
      clearTimeout(pendingCloseTimeout)
      pendingCloseTimeout = null
    }
  }

  function forceCloseWindow(win?: BrowserWindow | null): void {
    clearPendingCloseTimeout()
    options.setAllowClose(true)

    const target = win ?? options.getMainWindow()
    if (!target || target.isDestroyed()) return

    target.close()
    if (!target.isDestroyed()) {
      target.destroy()
    }
  }

  async function promptForceCloseDueToRendererFailure(win: BrowserWindow): Promise<void> {
    if (win.isDestroyed() || options.getAllowClose()) return

    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      title: '无法保存更改',
      message: '界面进程异常，无法显示保存确认',
      detail: '关闭窗口将丢失未保存的更改。是否仍要关闭？',
      buttons: ['仍要关闭', '取消'],
      defaultId: 1,
      cancelId: 1,
    })

    if (response === 0) {
      forceCloseWindow(win)
    }
  }

  async function promptForceCloseDueToUnresponsiveRenderer(win: BrowserWindow): Promise<void> {
    if (win.isDestroyed() || options.getAllowClose()) return

    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      title: '界面无响应',
      message: '关闭确认未能及时显示',
      detail: '渲染进程可能已卡死或崩溃。是否强制退出？未保存的更改可能丢失。',
      buttons: ['强制退出', '继续等待'],
      defaultId: 1,
      cancelId: 1,
    })

    if (response === 0) {
      forceCloseWindow(win)
      return
    }

    pendingCloseTimeout = setTimeout(() => {
      pendingCloseTimeout = null
      void promptForceCloseDueToUnresponsiveRenderer(win)
    }, CLOSE_RENDERER_RESPONSE_TIMEOUT_MS)
  }

  function handleWindowClose(event: Electron.Event): void {
    const win = options.getMainWindow()
    if (!win) return

    const rendererAvailable = isRendererAvailable(
      options.getRendererHealth(),
      win.webContents.isCrashed(),
    )

    const action = resolveCloseInterceptAction({
      allowClose: options.getAllowClose(),
      documentDirty: options.getDocumentDirty(),
      rendererAvailable,
    })

    if (action === 'allow') return

    event.preventDefault()

    if (action === 'ask-main-force') {
      void promptForceCloseDueToRendererFailure(win)
      return
    }

    clearPendingCloseTimeout()
    options.onRequestRendererClose(win)
    pendingCloseTimeout = setTimeout(() => {
      pendingCloseTimeout = null
      void promptForceCloseDueToUnresponsiveRenderer(win)
    }, CLOSE_RENDERER_RESPONSE_TIMEOUT_MS)
  }

  function handleRendererCloseDecision(decision: 'proceed' | 'cancel'): void {
    if (decision === 'cancel') {
      clearPendingCloseTimeout()
      return
    }

    clearPendingCloseTimeout()
    forceCloseWindow()
  }

  return {
    clearPendingCloseTimeout,
    forceCloseWindow,
    handleWindowClose,
    handleRendererCloseDecision,
  }
}
