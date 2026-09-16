import { describe, expect, it } from 'vitest'
import { dirname, join } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { closeAllBookDbs, closeBookDb, getBookDbDir, getBookDbPath, openBookDb } from './open-book-db'
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

  it('U2：只关一本，其它指纹句柄不受影响；库目录与 db 同哈希', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rosetta-close-one-'))
    try {
      openBookDb(dir, 'fp-1')
      const second = openBookDb(dir, 'fp-2')
      expect(getBookDbDir(dir, 'fp-1')).toBe(dirname(getBookDbPath(dir, 'fp-1')))
      expect(closeBookDb(dir, 'fp-1')).toBe(true)
      // 同一本再关返回 false；另一本仍是同一句柄；两本路径不同
      expect(closeBookDb(dir, 'fp-1')).toBe(false)
      expect(openBookDb(dir, 'fp-2')).toBe(second)
      expect(getBookDbPath(dir, 'fp-1')).not.toBe(getBookDbPath(dir, 'fp-2'))
    } finally {
      closeAllBookDbs()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
