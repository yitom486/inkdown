import { emitRailFocus } from '../rail-follow'
import { findTextRangeInRoot } from './excerpt-text-match'

/**
 * EPUB/MOBI 常驻标记统一几何层。
 *
 * 根因（乱画）：此前三套视觉各算各的位置——
 * - M0 foliate 原生块高亮（按 CFI，由 foliate 渲染），
 * - M1 分类虚线下划线（只按 excerpt 首匹配），
 * - M2 页边圆点（CFI 优先 excerpt 兜底，且 position:fixed）。
 * 同一张卡，下划线可能画在第一处、圆点落在 CFI 处；圆点 fixed 定位在
 * 流式滚动时相对视口不动、正文走了（只在切节/载入/标记变更时重算）。
 *
 * 统一规则：
 * 1. 同一 mark 同一文档只解算一个 Range（CFI 优先、excerpt 兜底），
 *    M1/M2 都从该 Range 派生——视觉再多层，位置单源。
 * 2. 圆点用文档内 absolute 定位（rect 视口坐标 + 文档滚动偏移），
 *    随内容滚动天然跟随，分页/流式两模式都成立；不再依赖重算时机。
 */

/** foliate view 的最小 CFI 解算口径（结构化兼容，调用方做 cast）。 */
export interface CfiResolverView {
  resolveCFI(cfi: string): { index: number; anchor: (doc: Document) => Range | null }
}

/**
 * 解算 mark 在指定渲染文档中的 Range：
 * CFI 命中（含 index 归属校验）即用；否则 excerpt 兜底；都没有返回 null。
 * kind 不在此过滤（书签是否绘制由各层自定，M1 画、M2 不画——行为保持现状）。
 */
export function resolveMarkRange(
  doc: Document,
  docIndex: number,
  mark: { anchor: { format: string; cfiRange?: string; cfi?: string }; excerpt?: string | null },
  view: CfiResolverView | null | undefined,
): Range | null {
  const anchor = mark.anchor
  const cfi =
    anchor.format === 'epub' || anchor.format === 'mobi'
      ? (anchor.cfiRange ?? anchor.cfi)
      : undefined
  if (cfi && view) {
    try {
      const resolved = view.resolveCFI(cfi)
      if (resolved.index === docIndex) {
        const range = resolved.anchor(doc)
        if (range) return range
      }
    } catch {
      // CFI 失效落到 excerpt 兜底
    }
  }
  const excerpt = mark.excerpt?.trim()
  if (!excerpt || !doc.body) return null
  try {
    return findTextRangeInRoot(doc.body, excerpt)
  } catch {
    return null
  }
}

/** 取首行矩形（多行引用的外接矩形中点会落在行缝里，视觉偏上）。 */
export function firstLineRectOfRange(range: Range): DOMRect | null {
  try {
    const list = range.getClientRects()
    if (list.length > 0) return list[0] as DOMRect
    return range.getBoundingClientRect()
  } catch {
    return null
  }
}

export interface FlagSpot {
  /** 文档内坐标（已加滚动偏移，配合 absolute 使用）。 */
  left: number
  top: number
  size: number
}

/** 由 Range 算圆点文档内坐标；无合法矩形返回 null（调用方不画）。 */
export function flagSpotForRange(range: Range, doc: Document, size = 12): FlagSpot | null {
  const rect = firstLineRectOfRange(range)
  if (!rect || (rect.width <= 0 && rect.height <= 0)) return null
  const root = doc.documentElement
  const scrollLeft = root?.scrollLeft ?? 0
  const scrollTop = root?.scrollTop ?? 0
  return {
    left: Math.max(2, rect.left - size - 8 + scrollLeft),
    top: rect.top + rect.height / 2 - size / 2 + scrollTop,
    size,
  }
}

export interface MarkFlagStyle {
  background: string
  size?: number
}

/**
 * 构建页边圆点（absolute 文档内定位，随内容滚动；点击直达卡片）。
 * 几何用行内 !important：行内 important 高于样式表 important，
 * 任何版本/缓存的主题 CSS 都压不住（沿用旧实现装甲）。
 */
export function buildMarkFlag(
  doc: Document,
  markId: string,
  range: Range,
  style: MarkFlagStyle,
): HTMLDivElement | null {
  const size = style.size ?? 12
  const spot = flagSpotForRange(range, doc, size)
  if (!spot) return null
  const flag = doc.createElement('div')
  flag.setAttribute('data-inkdown-flag', markId)
  flag.style.cssText = `border-radius:9999px;background:${style.background};border:2px solid rgba(255,255,255,.9);box-shadow:0 1px 4px rgba(0,0,0,.35);cursor:pointer;z-index:5;padding:0;margin:0;`
  flag.style.setProperty('position', 'absolute', 'important')
  flag.style.setProperty('left', `${spot.left}px`, 'important')
  flag.style.setProperty('top', `${spot.top}px`, 'important')
  flag.style.setProperty('width', `${size}px`, 'important')
  flag.style.setProperty('height', `${size}px`, 'important')
  flag.addEventListener('click', (event) => {
    event.stopPropagation()
    emitRailFocus(markId)
  })
  return flag
}
