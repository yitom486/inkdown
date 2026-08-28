import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  dialog: {
    showMessageBox: vi.fn().mockResolvedValue({ response: 1 }),
  },
}))

import { createWindowCloseController } from './window-close'

function createHarness(initial: { allowClose?: boolean; documentDirty?: boolean; rendererHealth?: 'ok' | 'crashed' | 'unresponsive' } = {}) {
  let allowClose = initial.allowClose ?? false
  let documentDirty = initial.documentDirty ?? true
  let rendererHealth = initial.rendererHealth ?? 'ok'
  const onRequestRendererClose = vi.fn()

  const fakeWindow = {
    isDestroyed: () => false,
    close: vi.fn(),
    destroy: vi.fn(),
    webContents: {
      isCrashed: () => rendererHealth === 'crashed',
    },
  }

  const controller = createWindowCloseController({
    getMainWindow: () => fakeWindow as unknown as Electron.BrowserWindow,
    getAllowClose: () => allowClose,
    setAllowClose: (value) => {
      allowClose = value
    },
    getDocumentDirty: () => documentDirty,
    getRendererHealth: () => rendererHealth,
    onRequestRendererClose,
  })

  return {
    fakeWindow,
    onRequestRendererClose,
    controller,
    setRendererHealth: (health: 'ok' | 'crashed' | 'unresponsive') => {
      rendererHealth = health
    },
    getAllowClose: () => allowClose,
  }
}

describe('window-close controller', () => {
  it('渲染进程正常时拦截关闭并请求 renderer 确认', () => {
    const harness = createHarness()
    const event = { preventDefault: vi.fn() }

    harness.controller.handleWindowClose(event as unknown as Electron.Event)

    expect(event.preventDefault).toHaveBeenCalled()
    expect(harness.onRequestRendererClose).toHaveBeenCalledTimes(1)
    expect(harness.fakeWindow.close).not.toHaveBeenCalled()
  })

  it('renderer 不回应时用户确认后强制关闭', () => {
    const harness = createHarness()
    harness.controller.handleRendererCloseDecision('proceed')

    expect(harness.getAllowClose()).toBe(true)
    expect(harness.fakeWindow.close).toHaveBeenCalledTimes(1)
  })

  it('渲染进程崩溃时不再等待 renderer，且不发送关闭请求', () => {
    const harness = createHarness({ rendererHealth: 'crashed' })
    const event = { preventDefault: vi.fn() }

    harness.controller.handleWindowClose(event as unknown as Electron.Event)

    expect(event.preventDefault).toHaveBeenCalled()
    expect(harness.onRequestRendererClose).not.toHaveBeenCalled()
  })

  it('forceCloseWindow 在 close 无效时 destroy', () => {
    const harness = createHarness()
    harness.fakeWindow.close.mockImplementation(() => undefined)

    harness.controller.forceCloseWindow(harness.fakeWindow as unknown as Electron.BrowserWindow)

    expect(harness.getAllowClose()).toBe(true)
    expect(harness.fakeWindow.close).toHaveBeenCalledTimes(1)
    expect(harness.fakeWindow.destroy).toHaveBeenCalledTimes(1)
  })

  it('renderer 超时未回应且用户确认后强制关闭', async () => {
    vi.useFakeTimers()
    const { dialog } = await import('electron')
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 0 })

    const harness = createHarness()
    const event = { preventDefault: vi.fn() }

    harness.controller.handleWindowClose(event as unknown as Electron.Event)
    await vi.runAllTimersAsync()

    expect(harness.getAllowClose()).toBe(true)
    expect(harness.fakeWindow.close).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })
})
