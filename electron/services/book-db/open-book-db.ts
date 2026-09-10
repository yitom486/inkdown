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

/** 本书库目录（含 book.db）；U2 重建时整目录删除，不留旧块混入新索引 */
export function getBookDbDir(userDataDir: string, fingerprint: string): string {
  return dirname(getBookDbPath(userDataDir, fingerprint))
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

/**
 * U2：只关这一本的 handle（Windows 上不关就删不掉 db 文件）。
 * 返回是否真的关了一个已打开的 handle；其它书不受影响。
 */
export function closeBookDb(userDataDir: string, fingerprint: string): boolean {
  const dbPath = getBookDbPath(userDataDir, fingerprint)
  const db = openHandles.get(dbPath)
  if (!db) return false
  try {
    db.close()
  } finally {
    openHandles.delete(dbPath)
  }
  return true
}
