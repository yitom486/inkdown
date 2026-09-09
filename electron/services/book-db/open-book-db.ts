import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { migrateBookDb } from './schema'

/**
 * 单书一库打开器。路径与 ocr-cache 同哈希约定：
 * `userData/book-index/<sha256(fingerprint)[:16]>/book.db`。
 * userDataDir 由调用方传入（app.getPath），本模块不直连 electron，保证可单测。
 */

export function getBookDbPath(userDataDir: string, fingerprint: string): string {
  const hash = createHash('sha256').update(fingerprint).digest('hex').slice(0, 16)
  return join(userDataDir, 'book-index', hash, 'book.db')
}

const openHandles = new Map<string, DatabaseSync>()

export function openBookDb(userDataDir: string, fingerprint: string): DatabaseSync {
  const dbPath = getBookDbPath(userDataDir, fingerprint)
  const existing = openHandles.get(dbPath)
  if (existing) return existing
  mkdirSync(dirname(dbPath), { recursive: true })
  const db = new DatabaseSync(dbPath)
  migrateBookDb(db)
  openHandles.set(dbPath, db)
  return db
}

export function closeAllBookDbs(): void {
  for (const [dbPath, db] of openHandles) {
    try {
      db.close()
    } catch {
      // 关闭失败不阻断退出
    }
    openHandles.delete(dbPath)
  }
}
