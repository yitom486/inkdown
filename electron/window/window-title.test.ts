import { describe, expect, it } from 'vitest'
import { formatWindowTitle } from './window-title'

describe('formatWindowTitle', () => {
  it('无打开文件时仅显示应用名', () => {
    expect(formatWindowTitle(undefined, false, '轻量阅读器')).toBe('轻量阅读器')
  })

  it('脏标记追加圆点', () => {
    expect(formatWindowTitle('D:\\books\\novel.epub', true, '轻量阅读器')).toBe(
      'novel.epub • — 轻量阅读器',
    )
  })

  it('只取文件名部分', () => {
    expect(formatWindowTitle('/tmp/readme.md', false, 'App')).toBe('readme.md — App')
  })
})
