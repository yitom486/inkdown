import { describe, expect, it } from 'vitest'
import { resolveStartupRestoreTarget } from './workspace-session'

describe('resolveStartupRestoreTarget', () => {
  it('恢复在线文档优先于文件', () => {
    expect(
      resolveStartupRestoreTarget({
        restoreOnStartup: true,
        activeSurface: 'web-doc',
        lastWebDocUrl: 'https://example.com/doc',
        lastOpenedFilePath: 'D:\\a.md',
      }),
    ).toEqual({ kind: 'web-doc', path: 'https://example.com/doc' })
  })

  it('恢复上次打开的文件', () => {
    expect(
      resolveStartupRestoreTarget({
        restoreOnStartup: true,
        activeSurface: 'file',
        lastOpenedFilePath: 'D:\\notes.md',
      }),
    ).toEqual({ kind: 'file', path: 'D:\\notes.md' })
  })

  it('关闭恢复时不返回目标', () => {
    expect(
      resolveStartupRestoreTarget({
        restoreOnStartup: false,
        activeSurface: 'file',
        lastOpenedFilePath: 'D:\\notes.md',
      }),
    ).toBeNull()
  })

  it('兼容仅有 lastOpenedFilePath 的旧快照', () => {
    expect(
      resolveStartupRestoreTarget({
        restoreOnStartup: true,
        activeSurface: 'none',
        lastOpenedFilePath: 'D:\\legacy.epub',
      }),
    ).toEqual({ kind: 'file', path: 'D:\\legacy.epub' })
  })
})
