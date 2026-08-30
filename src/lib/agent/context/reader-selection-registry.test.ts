import { describe, expect, it } from 'vitest'
import {
  beginPromptSelectionCycle,
  clearReaderSelection,
  commitReaderSelection,
  hasActiveSelection,
  readSelectionText,
  registerSelectionProvider,
  reviveSelectionNotify,
} from './reader-selection-registry'

describe('reader-selection-registry sticky', () => {
  it('commit 后 DOM 无选区仍能读到', () => {
    const dispose = registerSelectionProvider({
      filePath: '/book.epub',
      getSelectionText: () => null,
    })
    commitReaderSelection('/book.epub', '  战俘奴才  ')
    expect(readSelectionText('/book.epub')).toBe('战俘奴才')
    expect(hasActiveSelection()).toBe(true)
    dispose()
  })

  it('注销 provider 时清除同文件 sticky', () => {
    const dispose = registerSelectionProvider({
      filePath: '/book.epub',
      getSelectionText: () => null,
    })
    commitReaderSelection('/book.epub', '段落')
    dispose()
    expect(readSelectionText()).toBeNull()
  })

  it('clearReaderSelection 清空 sticky', () => {
    commitReaderSelection('/a.pdf', '页内文字')
    clearReaderSelection()
    expect(hasActiveSelection()).toBe(false)
  })

  it('无 sticky 时回退到 provider 实时选区', () => {
    const dispose = registerSelectionProvider({
      filePath: '/note.md',
      getSelectionText: () => '编辑器选区',
    })
    expect(readSelectionText()).toBe('编辑器选区')
    dispose()
  })
})

describe('selection one-shot notify', () => {
  it('划选后第一轮 prompt 通知，本轮工具仍可读', () => {
    commitReaderSelection('/book.epub', '共天下')
    expect(beginPromptSelectionCycle()).toBe(true)
    expect(readSelectionText()).toBe('共天下')
  })

  it('下一轮未重新划选则不再通知，并清掉 sticky', () => {
    commitReaderSelection('/book.epub', '共天下')
    expect(beginPromptSelectionCycle()).toBe(true)
    expect(beginPromptSelectionCycle()).toBe(false)
    expect(readSelectionText()).toBeNull()
    expect(hasActiveSelection()).toBe(false)
  })

  it('重新划选（含相同文字）再次通知', () => {
    commitReaderSelection('/book.epub', '共天下')
    expect(beginPromptSelectionCycle()).toBe(true)
    expect(beginPromptSelectionCycle()).toBe(false)

    commitReaderSelection('/book.epub', '共天下')
    expect(beginPromptSelectionCycle()).toBe(true)
    expect(readSelectionText()).toBe('共天下')
  })

  it('换了选区内容会在下一轮通知新内容', () => {
    commitReaderSelection('/book.epub', '旧选区')
    expect(beginPromptSelectionCycle()).toBe(true)

    commitReaderSelection('/book.epub', '新选区')
    expect(beginPromptSelectionCycle()).toBe(true)
    expect(readSelectionText()).toBe('新选区')
  })

  it('reviveSelectionNotify 可在问 Agent 时重新挂起通知', () => {
    commitReaderSelection('/book.epub', '选段')
    expect(beginPromptSelectionCycle()).toBe(true)
    expect(beginPromptSelectionCycle()).toBe(false)
    expect(reviveSelectionNotify()).toBe(false) // sticky 已清

    commitReaderSelection('/book.epub', '选段')
    expect(beginPromptSelectionCycle()).toBe(true)
    // 本轮工具仍可读；模拟「问 Agent」在通知已消费后再次挂起
    expect(readSelectionText()).toBe('选段')
    expect(reviveSelectionNotify()).toBe(true)
    expect(beginPromptSelectionCycle()).toBe(true)
  })
})
