import { describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { BOOK_DB_SCHEMA_VERSION, getBookDbVersion, migrateBookDb } from './schema'

describe('book-db schema', () => {
  it('全新库一次升到当前版本且可重复执行', () => {
    const db = new DatabaseSync(':memory:')
    const first = migrateBookDb(db)
    expect(first).toEqual({ migrated: true, version: BOOK_DB_SCHEMA_VERSION })
    expect(migrateBookDb(db)).toEqual({ migrated: false, version: BOOK_DB_SCHEMA_VERSION })
    db.close()
  })

  it('v2 含 completed_pages 列（续跑进度）', () => {
    const db = new DatabaseSync(':memory:')
    migrateBookDb(db)
    const columns = db.prepare('PRAGMA table_info(books)').all() as { name?: unknown }[]
    expect(columns.map((c) => c.name)).toContain('completed_pages')
    expect(getBookDbVersion(db)).toBe(BOOK_DB_SCHEMA_VERSION)
    db.close()
  })

  it('v3 含 toc_signature 列与 toc_entries 表（目录重建，前向兼容只新增）', () => {
    const db = new DatabaseSync(':memory:')
    migrateBookDb(db)
    const columns = db.prepare('PRAGMA table_info(books)').all() as { name?: unknown }[]
    expect(columns.map((c) => c.name)).toContain('toc_signature')
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
      name?: unknown
    }[]
    expect(tables.map((t) => t.name)).toContain('toc_entries')
    const tocColumns = db.prepare('PRAGMA table_info(toc_entries)').all() as { name?: unknown }[]
    expect(tocColumns.map((c) => c.name)).toEqual([
      'id',
      'book_id',
      'toc_index',
      'title',
      'level',
      'start_page',
      'end_page',
    ])
    expect(getBookDbVersion(db)).toBe(BOOK_DB_SCHEMA_VERSION)
    db.close()
  })

  it('v4 含 source/extract_version 列（块来源标注，只新增）', () => {
    const db = new DatabaseSync(':memory:')
    migrateBookDb(db)
    const columns = db.prepare('PRAGMA table_info(blocks)').all() as {
      name?: unknown
      dflt_value?: unknown
    }[]
    const byName = new Map(columns.map((c) => [c.name, c.dflt_value]))
    expect(byName.get('source')).toBe("'unknown'")
    expect(byName.get('extract_version')).toBe("''")
    expect(getBookDbVersion(db)).toBe(BOOK_DB_SCHEMA_VERSION)
    db.close()
  })

  it('v3→v4 迁移回填旧行来源（有 bbox→ocr，否则 native）', () => {
    const db = new DatabaseSync(':memory:')
    migrateBookDb(db)
    // 退回 v3 形态：删列 + 版本号回拨，再造旧行
    db.exec('ALTER TABLE blocks DROP COLUMN source')
    db.exec('ALTER TABLE blocks DROP COLUMN extract_version')
    db.exec('PRAGMA user_version = 3')
    db.prepare(
      `INSERT INTO books
        (fingerprint, title, source_path, format, page_count, page_offset, clean_version, completed_pages, toc_signature, created_at, updated_at)
       VALUES ('legacy-fp', '旧书', 'D:/book/legacy.pdf', 'pdf', 2, 0, 'ocr-watermark-v3', '[]', '', 1, 1)`,
    ).run()
    const bookId = 1
    db.prepare(
      `INSERT INTO blocks
        (book_id, chapter_id, chapter_index, block_index, type, content, page_number, bbox, confidence)
       VALUES (?, NULL, -1, ?, 'paragraph', ?, ?, ?, NULL)`,
    ).run(bookId, 0, '原生段落', 1, null)
    db.prepare(
      `INSERT INTO blocks
        (book_id, chapter_id, chapter_index, block_index, type, content, page_number, bbox, confidence)
       VALUES (?, NULL, -1, ?, 'paragraph', ?, ?, ?, ?)`,
    ).run(bookId, 1, 'OCR 段落', 2, '{"x":1,"y":2,"width":3,"height":4}', 0.9)
    const migrated = migrateBookDb(db)
    expect(migrated).toEqual({ migrated: true, version: 4 })
    const rows = db
      .prepare('SELECT content AS c, source AS s FROM blocks ORDER BY id')
      .all() as { c: string; s: string }[]
    expect(rows).toEqual([
      { c: '原生段落', s: 'native' },
      { c: 'OCR 段落', s: 'ocr' },
    ])
    db.close()
  })
})
