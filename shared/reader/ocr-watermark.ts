import type { InspectorSpanLike } from './ocr-page-words'

/**
 * OCR 水印清洗（纯逻辑，主/渲染进程复用）。
 *
 * 背景：扫描书 OCR 文本常混入跨页重复的版式家具——斜水印（王道计算机教育 碎片）、
 * 页眉页脚、重复分隔线。旧做法按原文整行频次删除，曾误删表格分隔线与跨页重复的
 * 真实小节标题（“二、综合应用题”）。本模块用两条规则避免重蹈覆辙：
 * 1. 自动发现必须有几何证据（spans 同文本 + 同位置跨页出现），纯文本频次不自动定罪；
 * 2. 表格行（`|`/分隔线）与页标记（`<!-- Page N -->`）永不删除。
 */

export interface OcrWatermarkPageInput {
  /** 1-indexed */
  page: number
  markdown: string
  spans?: readonly InspectorSpanLike[] | undefined
}

export interface OcrWatermarkCleanResult {
  pages: { page: number; markdown: string }[]
  removedLines: number
  trimmedLines: number
  /** 发现的水印集合大小（含传入的 known） */
  watermarkCount: number
  /** 归一化后的水印文本（排序，便于审计） */
  watermarks: string[]
}

export interface CleanOcrWatermarksOptions {
  /** 调用方已知的归一化水印（书级记忆/用户自定义）；超长条目会被忽略 */
  known?: readonly string[] | undefined
}

/** 水印行长度上限（归一化后字符数）；正文段落天然超长，不会进发现集合 */
const MAX_WATERMARK_CHARS = 24
/** 位置聚类网格（PDF 点）；同书同尺寸页面内，水印落点稳定 */
const POSITION_GRID_PT = 36
/** 发现阈值上限：整本再大也不超过 8 页作证 */
const MAX_DISCOVERY_PAGES = 8
/** 与 normalizeInspectorSpans 对齐的 span 置信度门限 */
const MIN_SPAN_CONFIDENCE = 0.3

const HEADING_PREFIX = /^#+\s*/
const PAGE_MARKER = /^\s*<!--.*-->\s*$/
const TABLE_SEPARATOR = /^[\s|:-]+$/

function isTableLine(line: string): boolean {
  return line.includes('|') || TABLE_SEPARATOR.test(line)
}

/**
 * 归一化：NFKC（全角拉丁→半角）→ 去标题标记、去全部空白（含全角）与中英文标点、拉丁小写。
 * “王道 育”与“王道育”、“bilibili.com”与“B站 bilibili．com”归一到同一键。
 */
export function normalizeWatermarkText(line: string): string {
  return line
    .normalize('NFKC')
    .replace(HEADING_PREFIX, '')
    .replace(
      /[\s　\t·•・|｜丨—–\-_~～.。…、，,．:：;；!！?？【】\[\]()（）<>《》""''「」『』＂＇·‐‑‒―‖‗‘’‚‛“”„‟†‡‰‱′″‴※‼‾‿#＃$＄%&＆*＊+＋=＝@＠^＾`｀\\/／]/g,
      '',
    )
    .toLowerCase()
}

function discoveryThreshold(totalPages: number): number {
  if (totalPages <= 3) return totalPages
  return Math.min(MAX_DISCOVERY_PAGES, Math.max(3, Math.ceil(totalPages * 0.2)))
}

function quantize(value: number): number {
  return Math.round(value / POSITION_GRID_PT)
}

/**
 * 几何发现：同归一化文本落在同网格的 span，跨页计数。
 * 落在同格 + 跨页重复 ⇒ 版式家具（水印/页眉页脚），与阅读流位置无关。
 */
export function discoverWatermarksByPosition(
  pages: readonly OcrWatermarkPageInput[],
): string[] {
  if (pages.length < 3) return []
  const threshold = discoveryThreshold(pages.length)
  const hits = new Map<string, Set<number>>()
  for (const { page, spans } of pages) {
    if (!spans || !Number.isFinite(page)) continue
    for (const span of spans) {
      if (!span || typeof span.text !== 'string') continue
      if (!(span.confidence >= MIN_SPAN_CONFIDENCE)) continue
      if (!(span.width > 0) || !(span.height > 0)) continue
      const norm = normalizeWatermarkText(span.text)
      if (norm.length === 0 || norm.length > MAX_WATERMARK_CHARS) continue
      const key = `${norm}@${quantize(span.x + span.width / 2)}:${quantize(span.y + span.height / 2)}`
      let set = hits.get(key)
      if (!set) {
        set = new Set()
        hits.set(key, set)
      }
      set.add(page)
    }
  }
  const found = new Set<string>()
  for (const [key, set] of hits) {
    if (set.size >= threshold) found.add(key.slice(0, key.lastIndexOf('@')))
  }
  return [...found].sort()
}

/** 碎片亲和：短行长度上限；仅补几何发现的漏网碎片 */
const MAX_FRAGMENT_CHARS = 10
/** 碎片亲和要求的水印母体最小长度，避免短水印误吸正文 */
const MIN_FRAGMENT_PARENT_CHARS = 6

/**
 * 碎片亲和：归一化短行是已证水印的子串（如“王道计算”⊂“王道计算机教育”），
 * 且跨页频次达标 ⇒ 同一水印的不同切分，一并清除。
 * 长正文天然超长进不了候选；短正文行（如“王道在线”）不是水印子串，进不了集合。
 */
export function expandWatermarkFragments(
  pages: readonly OcrWatermarkPageInput[],
  watermarks: ReadonlySet<string>,
): string[] {
  if (pages.length < 3 || watermarks.size === 0) return []
  const parents = [...watermarks].filter((w) => w.length >= MIN_FRAGMENT_PARENT_CHARS)
  if (parents.length === 0) return []
  const threshold = discoveryThreshold(pages.length)
  const hits = new Map<string, Set<number>>()
  for (const { page, markdown } of pages) {
    for (const line of markdown.split('\n')) {
      if (isTableLine(line) || PAGE_MARKER.test(line)) continue
      const norm = normalizeWatermarkText(line)
      if (norm.length === 0 || norm.length > MAX_FRAGMENT_CHARS || watermarks.has(norm)) continue
      if (!parents.some((parent) => parent.includes(norm))) continue
      let set = hits.get(norm)
      if (!set) {
        set = new Set()
        hits.set(norm, set)
      }
      set.add(page)
    }
  }
  return [...hits.entries()]
    .filter(([, set]) => set.size >= threshold)
    .map(([norm]) => norm)
    .sort()
}

function splitHeading(line: string): { prefix: string; body: string } {
  const match = /^(#+\s*)/.exec(line)
  if (!match) return { prefix: '', body: line }
  return { prefix: match[1] ?? '', body: line.slice((match[1] ?? '').length) }
}

/**
 * 单行清洗：整行命中则删；首尾水印 token 则修剪（“题库 王道计”→“题库”）。
 * 无空白分隔的连续行只做整行匹配，不做子串手术，避免误伤正文。
 * 修剪后回到整行判定（至多 4 轮），处理“水印+水印” glued 行的层层剥离。
 */
function cleanLine(line: string, watermarks: ReadonlySet<string>): string | null {
  if (line.trim().length === 0 || PAGE_MARKER.test(line) || isTableLine(line)) return line
  let current = line
  for (let round = 0; round < 4; round += 1) {
    const next = cleanLineOnce(current, watermarks)
    if (next === null || next === current) return next
    current = next
  }
  return current
}

function cleanLineOnce(line: string, watermarks: ReadonlySet<string>): string | null {
  const { prefix, body } = splitHeading(line)
  if (body.trim().length === 0) return line
  if (watermarks.has(normalizeWatermarkText(body))) return null
  const tokens = body.split(/\s+/).filter((token) => token.length > 0)
  if (tokens.length < 2) {
    // 无分隔连续行：仅处理“同一水印叠写两次”（王道计王道计）这种无歧义情形
    const norm = normalizeWatermarkText(body)
    if (norm.length % 2 === 0) {
      const half = norm.slice(0, norm.length / 2)
      if (watermarks.has(half) && norm === half + half) return null
    }
    return line
  }
  let start = 0
  let end = tokens.length
  while (start < end && watermarks.has(normalizeWatermarkText(tokens[start] ?? ''))) start += 1
  while (end > start && watermarks.has(normalizeWatermarkText(tokens[end - 1] ?? ''))) end -= 1
  if (start === 0 && end === tokens.length) return line
  if (start >= end) return null
  return `${prefix}${tokens.slice(start, end).join(' ')}`
}

export function cleanOcrWatermarks(
  pages: readonly OcrWatermarkPageInput[],
  options?: CleanOcrWatermarksOptions,
): OcrWatermarkCleanResult {
  const watermarks = new Set<string>(discoverWatermarksByPosition(pages))
  for (const known of options?.known ?? []) {
    const norm = normalizeWatermarkText(known)
    if (norm.length > 0 && norm.length <= MAX_WATERMARK_CHARS) watermarks.add(norm)
  }
  // 碎片亲和只补“几何已证水印的子串”，不引入新母体，不放大误伤面
  for (const fragment of expandWatermarkFragments(pages, watermarks)) watermarks.add(fragment)
  let removedLines = 0
  let trimmedLines = 0
  const cleaned = pages.map(({ page, markdown }) => {
    const out: string[] = []
    for (const line of markdown.split('\n')) {
      const next = cleanLine(line, watermarks)
      if (next === null) {
        removedLines += 1
        continue
      }
      if (next !== line) trimmedLines += 1
      out.push(next)
    }
    return { page, markdown: out.join('\n') }
  })
  return {
    pages: cleaned,
    removedLines,
    trimmedLines,
    watermarkCount: watermarks.size,
    watermarks: [...watermarks].sort(),
  }
}
