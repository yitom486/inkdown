import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { migrateInkdownDb } from './schema'

/**
 * 全局一库打开器：`userData/inkdown.db`（跨书数据：测验；见 .plan/marks-sqlite/02）。
 * userDataDir 由调用方传入（app.getPath），本模块不直连 electron，保证可单测。
 * 与 `book-db/open-book-db` 同模式：句柄缓存 + 打开即迁移。
 */

export function getInkdownDbPath(userDataDir: string): string {
  return join(userDataDir, 'inkdown.db')
}

const openHandles = new Map<string, DatabaseSync>()

export function openInkdownDb(userDataDir: string): DatabaseSync {
  const dbPath = getInkdownDbPath(userDataDir)
  const existing = openHandles.get(dbPath)
  if (existing) return existing
  mkdirSync(userDataDir, { recursive: true })
  const db = new DatabaseSync(dbPath)
  migrateInkdownDb(db)
  openHandles.set(dbPath, db)
  return db
}

export function closeAllInkdownDbs(): void {
  for (const [dbPath, db] of openHandles) {
    try {
      db.close()
    } catch {
      // 关闭失败不阻断退出
    }
    openHandles.delete(dbPath)
  }
}
