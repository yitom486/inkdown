import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { migrateBookDb } from './schema'
import { importBookPages } from './import-book'
import { countBookBlocks, getChapterBlocks, locateBlock, searchBookBlocks } from './queries'

/**
 * 真书回归（默认跳过）：ROSETTA_FIXTURE_DIR 指向含
 * wangdao-full-raw-v2.md + wangdao-spans.json 的目录时启用。
 * 验证整书导入的块数/顺序/章范围/中文 FTS/块定位。
 */
const fixtureDir = process.env.ROSETTA_FIXTURE_DIR ?? ''
function fixtureExists(): boolean {
  if (!fixtureDir) return false
  try {
    readFileSync(join(fixtureDir, 'wangdao-full-raw-v2.md'))
    readFileSync(join(fixtureDir, 'wangdao-spans.json'))
    return true
  } catch {
    return false
  }
}

describe.skipIf(!fixtureExists())('rosetta-book 王道整书导入', () => {
  it('340页全量索引可用', () => {
    const raw = readFileSync(join(fixtureDir, 'wangdao-full-raw-v2.md'), 'utf8')
    const stored = JSON.parse(readFileSync(join(fixtureDir, 'wangdao-spans.json'), 'utf8')) as {
      page: number
      spans: { text: string; x: number; y: number; width: number; height: number; confidence: number }[]
    }[]
    const spansByPage = new Map(stored.map((s) => [s.page, s.spans]))
    const parts = raw.split(/<!-- Page (\d+) -->/)
    const pages: { page: number; markdown: string }[] = []
    for (let i = 1; i < parts.length; i += 2) {
      pages.push({ page: Number(parts[i]), markdown: (parts[i + 1] ?? '').trim() })
    }

    const pairs: { real: number; printed: number; ch: string }[] = []
    const sections = new Map<string, number>()
    let ch1 = 0
    for (const { page, markdown } of pages) {
      if (markdown.includes('第1章 计算机系统概述 *1.1')) ch1 = ch1 === 0 ? page : Math.min(ch1, page)
      for (const line of markdown.split('\n')) {
        const body = line.replace(/^#+\s*/, '').trim()
        const m = /^第([467])章\s*(.+?)\s*(\d+)\s*$/.exec(body)
        if (m) pairs.push({ real: page, printed: Number(m[3]), ch: m[1] as string })
        if (/^第[1-7一二三四五六七]章/.test(body)) continue
        const sec = /^(\d+\.\d+(?:\.\d+)*)\s+(\S.{0,30})$/.exec(body)
        if (sec && !sections.has(body)) sections.set(body, page)
      }
    }
    const firstPrinted = new Map<string, number>()
    for (const p of [...pairs].sort((a, b) => a.real - b.real)) {
      if (!firstPrinted.has(p.ch)) firstPrinted.set(p.ch, p.printed)
    }
    const chNames: Record<string, string> = {
      '1': '第1章 计算机系统概述',
      '4': '第4章 指令系统',
      '6': '第6章 总线',
      '7': '第7章 输入/输出系统',
    }

    const db = new DatabaseSync(':memory:')
    const result = importBookPages(db, {
      fingerprint: 'wangdao-2027-comp-arch',
      title: '2027计算机组成原理考研复习指导',
      sourcePath: 'D:/book/2027计算机组成原理_高清带书签版.pdf',
      format: 'pdf',
      pageCount: 340,
      pageOffset: 12,
      cleanVersion: 'ocr-watermark-v3',
      printedToc: [
        { title: chNames['1'] as string, realPage: ch1, level: 1 },
        ...[...firstPrinted.entries()].map(([ch, printed]) => ({
          title: chNames[ch] as string,
          printedPage: printed,
          level: 1,
        })),
        ...[...sections.entries()].map(([title, realPage]) => ({ title, realPage, level: 2 })),
      ],
      pages,
      spansByPage,
    })
    expect(result.imported).toBe(true)
    expect(result.pages).toBe(340)
    expect(result.chapters).toBe(4)
    expect(result.blocks).toBeGreaterThan(8000)
    expect(countBookBlocks(db, result.bookId)).toBe(result.blocks)

    // 第4章（chapter_index 1）块页码全落在 [161,288]，顺序连续
    const ch4 = getChapterBlocks(db, result.bookId, 1)
    expect(ch4.length).toBeGreaterThan(500)
    expect(ch4.every((b) => b.pageNumber >= 161 && b.pageNumber <= 288)).toBe(true)
    expect(ch4.map((b) => b.blockIndex)).toEqual(ch4.map((_, i) => i))

    // 中文 FTS：命中带章定位；无意义串零命中
    const hits = searchBookBlocks(db, result.bookId, '流水线', 5)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0]?.snippet).toContain('流水线')
    expect(searchBookBlocks(db, result.bookId, '锟斤拷烫')).toEqual([])

    // 块定位：有 bbox 的段落回页码+bbox
    const located = ch4.find((b) => b.type === 'paragraph')
    if (located) {
      const pos = locateBlock(db, located.id)
      expect(pos?.pageNumber).toBe(located.pageNumber)
    }
    const bboxRate = db
      .prepare(
        `SELECT CAST(SUM(bbox IS NOT NULL) AS REAL) / COUNT(*) AS r FROM blocks
         WHERE book_id = ? AND type != 'table'`,
      )
      .get(result.bookId) as { r: number }
    console.log(`bbox 落定率: ${(bboxRate.r * 100).toFixed(1)}%`)
    expect(bboxRate.r).toBeGreaterThan(0.3)
    db.close()
  })
})
