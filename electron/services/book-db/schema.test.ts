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
})
