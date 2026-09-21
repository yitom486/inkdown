// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import {
  buildMarkFlag,
  firstLineRectOfRange,
  flagSpotForRange,
  resolveMarkRange,
  type CfiResolverView,
} from './epub-mark-overlay'
import { subscribeRailFocus } from '../rail-follow'

/**
 * EPUB 常驻标记统一几何层测试（happy-dom 真 DOM + stub 矩形）。
 * 锁定统一规则：CFI 优先 excerpt 兜底的单 Range 口径、absolute 文档内定位。
 * （happy-dom 无排版引擎：getClientRects 按 stub 矩形注入。）
 */

function docWithParagraphs(...texts: string[]): Document {
  const doc = document.implementation.createHTMLDocument('section')
  for (const text of texts) {
    const p = doc.createElement('p')
    p.textContent = text
    doc.body.appendChild(p)
  }
  return doc
}

function stubRects(range: Range, rects: Array<{ left: number; top: number; width: number; height: number }>) {
  vi.spyOn(range, 'getClientRects').mockReturnValue(rects as unknown as DOMRectList)
  vi.spyOn(range, 'getBoundingClientRect').mockReturnValue(
    rects[0] as unknown as DOMRect,
  )
}

function viewWith(anchor: (doc: Document) => Range | null, index = 0): CfiResolverView {
  return { resolveCFI: () => ({ index, anchor }) }
}

describe('resolveMarkRange', () => {
  it('CFI 命中即用（即使 excerpt 首匹配在别处——终结 M1/M2 分叉）', () => {
    const doc = docWithParagraphs('目标摘录第一处', '中间文字', '目标摘录第二处')
    const cfiRange = doc.createRange()
    cfiRange.selectNodeContents(doc.body.children[2]!)
    const mark = {
      anchor: { format: 'epub', cfiRange: 'epubcfi(/6/10!/4/6)', cfi: 'epubcfi(/6/10!/4/6)' },
      excerpt: '目标摘录',
    }
    const resolved = resolveMarkRange(doc, 0, mark, viewWith(() => cfiRange))
    expect(resolved).toBe(cfiRange)
  })

  it('CFI 抛错/归属他节时落到 excerpt 兜底', () => {
    const doc = docWithParagraphs('兜底摘录正文')
    const mark = {
      anchor: { format: 'epub', cfiRange: 'epubcfi(/6/99)', cfi: 'epubcfi(/6/99)' },
      excerpt: '兜底摘录正文',
    }
    const throwing: CfiResolverView = {
      resolveCFI: () => {
        throw new Error('stale cfi')
      },
    }
    expect(resolveMarkRange(doc, 0, mark, throwing)).not.toBeNull()
    expect(resolveMarkRange(doc, 0, mark, viewWith(() => null, 7))).not.toBeNull()
  })

  it('无 CFI 无摘录返回 null；pdf 锚点不走 CFI', () => {
    const doc = docWithParagraphs('内容')
    expect(
      resolveMarkRange(doc, 0, { anchor: { format: 'epub' }, excerpt: '' }, viewWith(() => null)),
    ).toBeNull()
    const pdfMark = { anchor: { format: 'pdf' }, excerpt: '内容' }
    const resolveCFI = vi.fn()
    const range = resolveMarkRange(doc, 0, pdfMark, { resolveCFI } as unknown as CfiResolverView)
    expect(resolveCFI).not.toHaveBeenCalled()
    expect(range).not.toBeNull()
  })
})

describe('flagSpotForRange', () => {
  it('圆点落首行左侧，含文档滚动偏移（absolute 文档内坐标）', () => {
    const doc = docWithParagraphs('一行文字内容')
    const range = doc.createRange()
    range.selectNodeContents(doc.body.children[0]!)
    stubRects(range, [{ left: 100, top: 50, width: 200, height: 20 }])
    doc.documentElement.scrollTop = 300
    const spot = flagSpotForRange(range, doc, 12)
    // left = 100 - 12 - 8；top = 50 + 10 - 6 + 300（滚动偏移）
    expect(spot).toEqual({ left: 80, top: 354, size: 12 })
  })

  it('无合法矩形返回 null（调用方不画）', () => {
    const doc = docWithParagraphs('文字')
    const range = doc.createRange()
    range.selectNodeContents(doc.body.children[0]!)
    stubRects(range, [{ left: 0, top: 0, width: 0, height: 0 }])
    expect(flagSpotForRange(range, doc)).toBeNull()
  })

  it('firstLineRectOfRange 取首行而非外接矩形', () => {
    const doc = docWithParagraphs('多行引用文字')
    const range = doc.createRange()
    range.selectNodeContents(doc.body.children[0]!)
    const first = { left: 10, top: 20, width: 300, height: 18 }
    const second = { left: 10, top: 40, width: 300, height: 18 }
    stubRects(range, [first, second])
    expect(firstLineRectOfRange(range)).toBe(first as unknown as DOMRect)
  })
})

describe('buildMarkFlag', () => {
  it('absolute 定位 + markId + 背景色，点击直达卡片', () => {
    const doc = docWithParagraphs('旗标行文字内容')
    const range = doc.createRange()
    range.selectNodeContents(doc.body.children[0]!)
    stubRects(range, [{ left: 100, top: 50, width: 200, height: 20 }])

    const flag = buildMarkFlag(doc, 'mark-7', range, { background: 'rgb(1, 2, 3)' })
    expect(flag).not.toBeNull()
    expect(flag!.getAttribute('data-inkdown-flag')).toBe('mark-7')
    expect(flag!.style.position).toBe('absolute')
    expect(flag!.style.left).toBe('80px')
    expect(flag!.style.top).toBe('54px')
    expect(flag!.style.background).toContain('rgb(1, 2, 3)')

    const seen: string[] = []
    const off = subscribeRailFocus((id) => seen.push(id))
    try {
      flag!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(seen).toEqual(['mark-7'])
    } finally {
      off()
    }
  })

  it('无合法矩形返回 null', () => {
    const doc = docWithParagraphs('文字')
    const range = doc.createRange()
    range.selectNodeContents(doc.body.children[0]!)
    stubRects(range, [])
    vi.spyOn(range, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 0,
      height: 0,
    } as unknown as DOMRect)
    expect(buildMarkFlag(doc, 'm', range, { background: 'red' })).toBeNull()
  })
})
