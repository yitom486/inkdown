import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { closeAllBookDbs, getBookDbPath, openBookDb } from './open-book-db'
import { BOOK_DB_SCHEMA_VERSION, getBookDbVersion } from './schema'

describe('open-book-db', () => {
  it('同指纹复用句柄，路径哈希约定稳定', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rosetta-open-'))
    try {
      const first = openBookDb(dir, 'fp-1')
      expect(first).toBe(openBookDb(dir, 'fp-1'))
      expect(getBookDbPath(dir, 'fp-1')).toBe(getBookDbPath(dir, 'fp-1'))
      expect(getBookDbPath(dir, 'fp-1')).not.toBe(getBookDbPath(dir, 'fp-2'))
      expect(getBookDbVersion(first)).toBe(BOOK_DB_SCHEMA_VERSION)
    } finally {
      closeAllBookDbs()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
