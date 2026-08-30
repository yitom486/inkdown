import { describe, expect, it } from 'vitest'
import {
  buildReaderUnitTree,
  shouldExpandReaderUnitNode,
} from '@/lib/reader/reader-unit-tree'
import { estimatePageOffsetTop, PDF_PAGE_GAP_PX } from '@/lib/reader/pdf-page-metrics'

describe('pdf-page-metrics', () => {
  it('按统一页高估算 offsetTop', () => {
    expect(estimatePageOffsetTop(1, 800)).toBe(0)
    expect(estimatePageOffsetTop(3, 800, PDF_PAGE_GAP_PX)).toBe(2 * (800 + PDF_PAGE_GAP_PX))
  })
})

describe('reader-unit-tree', () => {
  const units = [
    { label: 'Chapter 1', href: '1', level: 0 },
    { label: '1.1', href: '5', level: 1 },
    { label: '1.2', href: '10', level: 1 },
    { label: 'Chapter 2', href: '20', level: 0 },
  ]

  it('扁平目录还原为树', () => {
    const tree = buildReaderUnitTree(units)
    expect(tree).toHaveLength(2)
    expect(tree[0]!.children).toHaveLength(2)
    expect(tree[1]!.children).toHaveLength(0)
  })

  it('默认展开到二级', () => {
    expect(shouldExpandReaderUnitNode(0)).toBe(true)
    expect(shouldExpandReaderUnitNode(1)).toBe(true)
    expect(shouldExpandReaderUnitNode(2)).toBe(false)
  })
})
