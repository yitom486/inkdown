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
})
