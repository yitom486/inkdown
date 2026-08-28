import { describe, expect, it } from 'vitest'
import { isRendererAvailable, resolveCloseInterceptAction } from './close-gate'

describe('close-gate', () => {
  it('无未保存更改或已允许关闭时直接放行', () => {
    expect(
      resolveCloseInterceptAction({
        allowClose: true,
        documentDirty: true,
        rendererAvailable: true,
      }),
    ).toBe('allow')

    expect(
      resolveCloseInterceptAction({
        allowClose: false,
        documentDirty: false,
        rendererAvailable: true,
      }),
    ).toBe('allow')
  })

  it('渲染进程可用且文档 dirty 时交由 renderer 确认', () => {
    expect(
      resolveCloseInterceptAction({
        allowClose: false,
        documentDirty: true,
        rendererAvailable: true,
      }),
    ).toBe('ask-renderer')
  })

  it('渲染进程不可用且文档 dirty 时由主进程强制确认', () => {
    expect(
      resolveCloseInterceptAction({
        allowClose: false,
        documentDirty: true,
        rendererAvailable: false,
      }),
    ).toBe('ask-main-force')
  })

  it('isRendererAvailable 在崩溃或无响应时为 false', () => {
    expect(isRendererAvailable('ok', false)).toBe(true)
    expect(isRendererAvailable('ok', true)).toBe(false)
    expect(isRendererAvailable('crashed', false)).toBe(false)
    expect(isRendererAvailable('unresponsive', false)).toBe(false)
  })
})
