import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { getBookDbPath } from './open-book-db'
import { migrateBookDb } from './schema'
import {
  BODY_WATERMARK_PREVIEW_MAX_SAMPLES,
  BODY_WATERMARK_PREVIEW_TEXT_LIMIT,
  previewBodyWatermarkFile,
  previewBodyWatermarkInDb,
} from './body-watermark-preview'

function openMemDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  migrateBookDb(db)
  return db
}

function seedBook(
  db: DatabaseSync,
  fingerprint: string,
  blocks: { type?: string; content: string; pageNumber: number }[],
): number {
  const now = Date.now()
  const bookId = Number(
    db
      .prepare(
        `INSERT INTO books
          (fingerprint, title, source_path, format, page_count, page_offset, clean_version, completed_pages, toc_signature, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, '[]', '', ?, ?)`,
      )
      .run(fingerprint, '预览测试书', 'D:/book/fake.pdf', 'pdf', 340, 0, 'ocr-watermark-v3', now, now)
      .lastInsertRowid,
  )
  const insertBlock = db.prepare(
    `INSERT INTO blocks
      (book_id, chapter_id, chapter_index, block_index, type, content, page_number, bbox, confidence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  blocks.forEach((block, index) => {
    insertBlock.run(
      bookId,
      null,
      0,
      index,
      block.type ?? 'paragraph',
      block.content,
      block.pageNumber,
      null,
      null,
    )
  })
  return bookId
}

function snapshotDb(db: DatabaseSync): { counts: Record<string, number>; hash: string } {
  const counts: Record<string, number> = {}
  const parts: string[] = []
  for (const table of ['books', 'chapters', 'blocks', 'toc_entries']) {
    const countRow = db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as {
      total?: unknown
    }
    const total = typeof countRow?.total === 'number' ? countRow.total : -1
    counts[table] = total
    const rows = db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()
    parts.push(`${table}:${JSON.stringify(rows)}`)
  }
  const ftsRow = db.prepare('SELECT COUNT(*) AS total FROM block_fts').get() as {
    total?: unknown
  }
  counts.block_fts = typeof ftsRow?.total === 'number' ? ftsRow.total : -1
  parts.push(`block_fts-count:${counts.block_fts}`)
  const hash = createHash('sha256').update(parts.join('\n')).digest('hex')
  return { counts, hash }
}

/** 真实文件库：在临时目录建 book.db 并写入数据后关闭句柄（绝不用用户 AppData） */
function createFileDb(
  fingerprint: string,
  blocks: { type?: string; content: string; pageNumber: number }[],
): { dir: string; dbPath: string } {
  const dir = mkdtempSync(join(tmpdir(), 'body-watermark-preview-file-'))
  const dbPath = getBookDbPath(dir, fingerprint)
  mkdirSync(dirname(dbPath), { recursive: true })
  const db = new DatabaseSync(dbPath)
  try {
    migrateBookDb(db)
    seedBook(db, fingerprint, blocks)
  } finally {
    db.close()
  }
  return { dir, dbPath }
}

function snapshotFile(dbPath: string): { hash: string; size: number; mtimeMs: number } {
  const bytes = readFileSync(dbPath)
  const stat = statSync(dbPath)
  return {
    hash: createHash('sha256').update(bytes).digest('hex'),
    size: stat.size,
    mtimeMs: stat.mtimeMs,
  }
}

describe('body-watermark-preview 只读预览', () => {
  it('预览 API：含水印块的总数/页数/reason 聚合正确', () => {
    const db = openMemDb()
    try {
      seedBook(db, 'preview-fp-1', [
        { content: '王', pageNumber: 36 },
        { content: '输入/输出系统 王道计', pageNumber: 36 },
        { content: '普通正文，无水印', pageNumber: 37 },
        { content: '王道计 王道计 机教育 机教育', pageNumber: 38 },
        { type: 'table', content: '王', pageNumber: 38 },
      ])
      const result = previewBodyWatermarkInDb(db, 'preview-fp-1')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.totalPatches).toBe(3)
      expect(result.value.deleteCount).toBe(2)
      expect(result.value.updateCount).toBe(1)
      expect(result.value.pageCount).toBe(2)
      expect(Object.values(result.value.reasonCounts).reduce((a, b) => a + b, 0)).toBe(3)
      const reasons = Object.keys(result.value.reasonCounts)
      expect(reasons.some((r) => r.includes('whole-block'))).toBe(true)
      expect(reasons.some((r) => r.includes('trim-edge'))).toBe(true)
      expect(reasons.some((r) => r.includes('trim-to-empty'))).toBe(true)
      expect(result.value.samples).toHaveLength(3)
    } finally {
      db.close()
    }
  })

  it('样例截断：超 20 条只返 20 条且文本被截断', () => {
    const db = openMemDb()
    try {
      const longBody = `正文内容${'正文内容'.repeat(20)}`
      seedBook(
        db,
        'preview-fp-truncate',
        Array.from({ length: 25 }, (_, i) => ({
          content: `第${i + 1}页${longBody} 王道计`,
          pageNumber: 36 + (i % 5),
        })),
      )
      const result = previewBodyWatermarkInDb(db, 'preview-fp-truncate')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.totalPatches).toBe(25)
      expect(result.value.samples).toHaveLength(BODY_WATERMARK_PREVIEW_MAX_SAMPLES)
      expect(BODY_WATERMARK_PREVIEW_MAX_SAMPLES).toBe(20)
      for (const sample of result.value.samples) {
        expect(sample.before.length).toBeLessThanOrEqual(BODY_WATERMARK_PREVIEW_TEXT_LIMIT + 1)
        if (sample.after) {
          expect(sample.after.length).toBeLessThanOrEqual(BODY_WATERMARK_PREVIEW_TEXT_LIMIT + 1)
        }
      }
      // 长文本必被截断（80 + …）
      expect(result.value.samples[0]?.before.endsWith('…')).toBe(true)
      expect(result.value.samples[0]?.before.length).toBe(BODY_WATERMARK_PREVIEW_TEXT_LIMIT + 1)
    } finally {
      db.close()
    }
  })

  it('读库失败：库文件不存在返回错误且不创建文件', () => {
    const dir = mkdtempSync(join(tmpdir(), 'body-watermark-preview-missing-'))
    try {
      const fingerprint = 'missing-fp-no-db'
      const result = previewBodyWatermarkFile(dir, fingerprint)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('FILE_NOT_FOUND')
      expect(existsSync(getBookDbPath(dir, fingerprint))).toBe(false)
      expect(readdirSync(dir)).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('零写入：预览前后全表快照（行数 + 内容哈希）一致', () => {
    const db = openMemDb()
    try {
      seedBook(db, 'preview-fp-readonly', [
        { content: '王', pageNumber: 36 },
        { content: '输入/输出系统 王道计', pageNumber: 36 },
        { content: '普通正文，无水印', pageNumber: 37 },
      ])
      const before = snapshotDb(db)
      const result = previewBodyWatermarkInDb(db, 'preview-fp-readonly')
      expect(result.ok).toBe(true)
      const after = snapshotDb(db)
      expect(after.counts).toEqual(before.counts)
      expect(after.hash).toBe(before.hash)
    } finally {
      db.close()
    }
  })

  it('真实文件只读：文件入口可用且 book.db 哈希/size/mtime 不变', () => {
    const fingerprint = 'preview-fp-file-readonly'
    const { dir, dbPath } = createFileDb(fingerprint, [
      { content: '王', pageNumber: 36 },
      { content: '输入/输出系统 王道计', pageNumber: 36 },
      { content: '普通正文，无水印', pageNumber: 37 },
    ])
    try {
      const before = snapshotFile(dbPath)
      const result = previewBodyWatermarkFile(dir, fingerprint)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      // 文件路径同样走 readOnly + query_only 且结果可用
      expect(result.value.totalPatches).toBe(2)
      expect(result.value.deleteCount).toBe(1)
      expect(result.value.updateCount).toBe(1)
      expect(result.value.pageCount).toBe(1)
      expect(result.value.samples).toHaveLength(2)
      expect(result.value.samplePage).toBe(null)
      const after = snapshotFile(dbPath)
      expect(after.hash).toBe(before.hash)
      expect(after.size).toBe(before.size)
      expect(after.mtimeMs).toBe(before.mtimeMs)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('真实文件按页筛选：仅 samples 过滤，全局统计不变', () => {
    const fingerprint = 'preview-fp-file-sample-page'
    const { dir, dbPath } = createFileDb(fingerprint, [
      { content: '王', pageNumber: 36 },
      { content: '输入/输出系统 王道计', pageNumber: 36 },
      { content: '王道计 王道计 机教育 机教育', pageNumber: 303 },
      { content: '正文 王道计算机教育', pageNumber: 303 },
      { content: '普通正文，无水印', pageNumber: 37 },
      { type: 'table', content: '王', pageNumber: 303 },
    ])
    try {
      const before = snapshotFile(dbPath)
      const globalResult = previewBodyWatermarkFile(dir, fingerprint)
      expect(globalResult.ok).toBe(true)
      if (!globalResult.ok) return
      expect(globalResult.value.totalPatches).toBe(4)
      expect(globalResult.value.deleteCount).toBe(2)
      expect(globalResult.value.updateCount).toBe(2)
      expect(globalResult.value.pageCount).toBe(2)
      expect(globalResult.value.samples).toHaveLength(4)
      expect(globalResult.value.samplePage).toBe(null)

      const page36 = previewBodyWatermarkFile(dir, fingerprint, 36)
      expect(page36.ok).toBe(true)
      if (!page36.ok) return
      // 全局统计不受 samplePage 影响
      expect(page36.value.totalPatches).toBe(globalResult.value.totalPatches)
      expect(page36.value.deleteCount).toBe(globalResult.value.deleteCount)
      expect(page36.value.updateCount).toBe(globalResult.value.updateCount)
      expect(page36.value.pageCount).toBe(globalResult.value.pageCount)
      expect(page36.value.reasonCounts).toEqual(globalResult.value.reasonCounts)
      expect(page36.value.samplePage).toBe(36)
      expect(page36.value.samples).toHaveLength(2)
      expect(page36.value.samples.every((sample) => sample.pageNumber === 36)).toBe(true)

      const page303 = previewBodyWatermarkFile(dir, fingerprint, 303)
      expect(page303.ok).toBe(true)
      if (!page303.ok) return
      expect(page303.value.totalPatches).toBe(globalResult.value.totalPatches)
      expect(page303.value.reasonCounts).toEqual(globalResult.value.reasonCounts)
      expect(page303.value.samplePage).toBe(303)
      expect(page303.value.samples).toHaveLength(2)
      expect(page303.value.samples.every((sample) => sample.pageNumber === 303)).toBe(true)

      // 无命中页：统计仍全局，样例为空
      const pageMiss = previewBodyWatermarkFile(dir, fingerprint, 999)
      expect(pageMiss.ok).toBe(true)
      if (!pageMiss.ok) return
      expect(pageMiss.value.totalPatches).toBe(4)
      expect(pageMiss.value.samples).toHaveLength(0)
      expect(pageMiss.value.samplePage).toBe(999)

      const after = snapshotFile(dbPath)
      expect(after.hash).toBe(before.hash)
      expect(after.size).toBe(before.size)
      expect(after.mtimeMs).toBe(before.mtimeMs)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('非法页码：0/-1/1.5/NaN/非数字返回 INVALID_ARGUMENT', () => {
    const db = openMemDb()
    try {
      seedBook(db, 'preview-fp-bad-page', [{ content: '王', pageNumber: 36 }])
      for (const bad of [0, -1, 1.5, Number.NaN]) {
        const result = previewBodyWatermarkInDb(db, 'preview-fp-bad-page', bad)
        expect(result.ok).toBe(false)
        if (result.ok) continue
        expect(result.error.code).toBe('INVALID_ARGUMENT')
      }
      const nonNumber = previewBodyWatermarkInDb(
        db,
        'preview-fp-bad-page',
        '36' as unknown as number,
      )
      expect(nonNumber.ok).toBe(false)
      if (!nonNumber.ok) expect(nonNumber.error.code).toBe('INVALID_ARGUMENT')
    } finally {
      db.close()
    }

    const fingerprint = 'preview-fp-file-bad-page'
    const { dir, dbPath } = createFileDb(fingerprint, [{ content: '王', pageNumber: 36 }])
    try {
      const before = snapshotFile(dbPath)
      for (const bad of [0, -1, 1.5]) {
        const result = previewBodyWatermarkFile(dir, fingerprint, bad)
        expect(result.ok).toBe(false)
        if (result.ok) continue
        expect(result.error.code).toBe('INVALID_ARGUMENT')
      }
      const after = snapshotFile(dbPath)
      expect(after.hash).toBe(before.hash)
      expect(after.size).toBe(before.size)
      expect(after.mtimeMs).toBe(before.mtimeMs)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
