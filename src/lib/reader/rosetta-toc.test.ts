import { describe, expect, it } from 'vitest'
import { resolveRosettaTocEntries } from './rosetta-toc'

describe('resolveRosettaTocEntries', () => {
  it('大纲优先：href 即真实页', () => {
    expect(
      resolveRosettaTocEntries({
        outlineUnits: [
          { label: '第1章', href: '8', level: 1 },
          { label: '1.1', href: '8', level: 2 },
          { label: '坏页', href: 'abc', level: 1 },
        ],
        ocrEntries: [{ title: '第1章', printedPage: 1, level: 1 }],
        pageOffset: 12,
        pageCount: 340,
      }),
    ).toEqual([
      { title: '第1章', realPage: 8, level: 1 },
      { title: '1.1', realPage: 8, level: 2 },
    ])
  })

  it('无大纲时印刷目录加偏移换算，超页丢弃', () => {
    expect(
      resolveRosettaTocEntries({
        outlineUnits: [],
        ocrEntries: [
          { title: '第1章', printedPage: 1, level: 1 },
          { title: '超页', printedPage: 9999, level: 1 },
        ],
        pageOffset: 12,
        pageCount: 340,
      }),
    ).toEqual([{ title: '第1章', realPage: 13, level: 1 }])
  })

  it('自建目录保存后 outlineUnits 已是课名：入库切章用课名，不用旧书签/旧印刷条目', () => {
    expect(
      resolveRosettaTocEntries({
        outlineUnits: [
          { label: '绪论', href: '13', level: 1 },
          { label: '第一章 计算机系统概述', href: '25', level: 1 },
        ],
        ocrEntries: [{ title: '旧印刷条目', printedPage: 1, level: 1 }],
        pageOffset: 12,
        pageCount: 340,
      }),
    ).toEqual([
      { title: '绪论', realPage: 13, level: 1 },
      { title: '第一章 计算机系统概述', realPage: 25, level: 1 },
    ])
  })
})
