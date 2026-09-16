import { describe, expect, it } from 'vitest'
import { shouldIgnoreWatchFilename } from './workspace-watcher'

describe('shouldIgnoreWatchFilename', () => {
  it('忽略隐藏文件与临时文件', () => {
    expect(shouldIgnoreWatchFilename('.vs\\settings.json')).toBe(true)
    expect(shouldIgnoreWatchFilename('~$draft.epub')).toBe(true)
    expect(shouldIgnoreWatchFilename('book.tmp')).toBe(true)
  })

  it('不忽略普通新增文件', () => {
    expect(shouldIgnoreWatchFilename('三言二拍.epub')).toBe(false)
    expect(shouldIgnoreWatchFilename('subdir\\新书.pdf')).toBe(false)
  })

  it('filename 为 null 时不忽略（触发全量重扫）', () => {
    expect(shouldIgnoreWatchFilename(null)).toBe(false)
  })
})
