import { mkdir, readFile, rename, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { app } from 'electron'
import { toAppError, type AppError } from '@inkdown/contracts'
import { err, ok, type Result } from '@inkdown/contracts'
import type {
  CreateReadingMarkPayload,
  ReadingMark,
  UpdateReadingMarkPayload,
} from '@inkdown/contracts'
import {
  applyReadingMarkDelete,
  applyReadingMarkUpdate,
  buildReadingMark,
  normalizeMarkFilePath as normalizeMarkFilePathCore,
  validateReadingAnchor,
} from '@inkdown/annotations'
import {
  exportMarksStore,
  findMarkDb,
  getMarkRow,
  importMarksStore,
  insertMarkRow,
  listLiveMarkRows,
  migrateMarksStoreToDb,
  resolveFingerprintForFile,
  rowToReadingMark,
  updateMarkRow,
} from './marks-db'
import { openBookDb } from './book-db/open-book-db'

export interface ReadingMarksFile {
  marks: ReadingMark[]
  tombstones?: Record<string, number>
}

export function getMarksFilePath(): string {
  return join(app.getPath('userData'), 'reading-marks.json')
}

/**
 * 后端开关（[2]-01 灰度/回滚）：默认走各书 book.db；
 * `INKDOWN_MARKS_BACKEND=file` 切回旧文件实现（保留旧代码路径）。
 */
export function useFileMarksBackend(): boolean {
  return process.env.INKDOWN_MARKS_BACKEND === 'file'
}

export async function readMarksStore(): Promise<ReadingMarksFile> {
  if (useFileMarksBackend()) return readMarksStoreFile()
  await ensureMarksMigrated()
  return exportMarksStore(app.getPath('userData'))
}

export async function writeMarksStore(store: ReadingMarksFile): Promise<void> {
  if (useFileMarksBackend()) return writeMarksStoreFile(store)
  await ensureMarksMigrated()
  importMarksStore(app.getPath('userData'), store)
}

async function readMarksStoreFile(): Promise<ReadingMarksFile> {
  const filePath = getMarksFilePath()
  try {
    const raw = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as ReadingMarksFile
    if (!Array.isArray(parsed.marks)) {
      return { marks: [] }
    }
    return parsed
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return { marks: [] }
    }
    throw error
  }
}

export async function writeMarksStoreFile(store: ReadingMarksFile): Promise<void> {
  const filePath = getMarksFilePath()
  await mkdir(app.getPath('userData'), { recursive: true })
  // 原子写：先落临时文件再 rename，同目录 rename 是原子操作，
  // 崩溃只会留下 .tmp（下次写入覆盖），主文件永不处于半写状态
  const tmpPath = `${filePath}.tmp`
  await writeFile(tmpPath, `${JSON.stringify(store, null, 2)}\n`, 'utf-8')
  await rename(tmpPath, filePath)
}

/** 已迁移过的 userData 目录（进程内记忆，跨目录测试互不干扰） */
const marksMigratedDirs = new Set<string>()

/**
 * 懒迁移：首个 DB 操作时把 reading-marks.json 按指纹灌库（一次性），
 * 先落 .bak 再灌，marker 防止重复。灰度期内旧文件保留，回滚切开关即回。
 */
async function ensureMarksMigrated(): Promise<void> {
  const userDataDir = app.getPath('userData')
  if (marksMigratedDirs.has(userDataDir)) return
  marksMigratedDirs.add(userDataDir)
  const marker = join(userDataDir, 'reading-marks.json.migrated-to-db')
  if (existsSync(marker)) return
  const store = await readMarksStoreFile()
  const hasData =
    store.marks.length > 0 || Object.keys(store.tombstones ?? {}).length > 0
  if (!hasData) {
    await writeFile(marker, JSON.stringify({ at: Date.now(), migrated: 0 }))
    return
  }
  await writeFile(
    join(userDataDir, 'reading-marks.json.bak'),
    `${JSON.stringify(store, null, 2)}\n`,
    'utf-8',
  )
  const stats = migrateMarksStoreToDb(userDataDir, store)
  await writeFile(marker, JSON.stringify({ at: Date.now(), ...stats }))
}

function normalizeMarkFilePath(filePath: string): string {
  return normalizeMarkFilePathCore(filePath, process.platform)
}

export async function listReadingMarks(
  filePath?: string,
): Promise<Result<ReadingMark[], AppError>> {
  try {
    if (useFileMarksBackend()) return listReadingMarksFile(filePath)
    await ensureMarksMigrated()
    const normalized = filePath?.trim()
    if (!normalized) {
      const store = await readMarksStore()
      return ok(store.marks.sort((a, b) => b.updatedAt - a.updatedAt))
    }
    const userDataDir = app.getPath('userData')
    const fingerprint = resolveFingerprintForFile(userDataDir, normalized)
    if (!fingerprint) return ok([])
    const db = openBookDb(userDataDir, fingerprint)
    const marks = listLiveMarkRows(db)
      .map(rowToReadingMark)
      .filter(
        (mark) => normalizeMarkFilePath(mark.filePath) === normalizeMarkFilePath(normalized),
      )
    return ok(marks.sort((a, b) => b.updatedAt - a.updatedAt))
  } catch (error) {
    return err(toAppError(error, '读取书签失败'))
  }
}

async function listReadingMarksFile(
  filePath?: string,
): Promise<Result<ReadingMark[], AppError>> {
  try {
    const store = await readMarksStoreFile()
    const normalized = filePath?.trim()
    const marks = normalized
      ? store.marks.filter(
          (mark) => normalizeMarkFilePath(mark.filePath) === normalizeMarkFilePath(normalized),
        )
      : store.marks
    return ok(marks.sort((a, b) => b.updatedAt - a.updatedAt))
  } catch (error) {
    return err(toAppError(error, '读取书签失败'))
  }
}

export async function createReadingMark(
  payload: CreateReadingMarkPayload,
): Promise<Result<ReadingMark, AppError>> {
  try {
    const filePath = payload.filePath.trim()
    if (!filePath) {
      return err({ code: 'UNKNOWN', message: '文件路径无效' })
    }

    const anchorError = validateReadingAnchor(payload.anchor)
    if (anchorError) {
      return err({ code: 'UNKNOWN', message: anchorError })
    }

    const now = Date.now()
    const mark: ReadingMark = buildReadingMark({
      id: randomUUID(),
      now,
      payload,
    })

    if (useFileMarksBackend()) {
      const store = await readMarksStoreFile()
      store.marks.push(mark)
      await writeMarksStoreFile(store)
      return ok(mark)
    }
    await ensureMarksMigrated()
    const db = openBookDb(app.getPath('userData'), payload.fileFingerprint)
    insertMarkRow(db, mark)
    return ok(mark)
  } catch (error) {
    return err(toAppError(error, '创建书签失败'))
  }
}

export async function updateReadingMark(
  payload: UpdateReadingMarkPayload,
): Promise<Result<ReadingMark, AppError>> {
  try {
    if (useFileMarksBackend()) {
      const store = await readMarksStoreFile()
      const index = store.marks.findIndex((mark) => mark.id === payload.id)
      if (index === -1) {
        return err({ code: 'FILE_NOT_FOUND', message: '书签不存在' })
      }
      const current = store.marks[index]!
      const next: ReadingMark = applyReadingMarkUpdate(current, payload, Date.now())
      store.marks[index] = next
      await writeMarksStoreFile(store)
      return ok(next)
    }
    await ensureMarksMigrated()
    const found = findMarkDb(app.getPath('userData'), payload.id)
    if (!found) {
      return err({ code: 'FILE_NOT_FOUND', message: '书签不存在' })
    }
    const row = getMarkRow(found.db, payload.id)
    if (!row || row.deleted_at !== null) {
      return err({ code: 'FILE_NOT_FOUND', message: '书签不存在' })
    }
    const next: ReadingMark = applyReadingMarkUpdate(rowToReadingMark(row), payload, Date.now())
    updateMarkRow(found.db, next)
    return ok(next)
  } catch (error) {
    return err(toAppError(error, '更新书签失败'))
  }
}

export async function deleteReadingMark(id: string): Promise<Result<void, AppError>> {
  try {
    if (useFileMarksBackend()) {
      const store = await readMarksStoreFile()
      const applied = applyReadingMarkDelete(store.marks, store.tombstones, id, Date.now())
      if (!applied) {
        return err({ code: 'FILE_NOT_FOUND', message: '书签不存在' })
      }
      await writeMarksStoreFile({ marks: applied.marks, tombstones: applied.tombstones })
      return ok(undefined)
    }
    await ensureMarksMigrated()
    const found = findMarkDb(app.getPath('userData'), id)
    if (!found) {
      return err({ code: 'FILE_NOT_FOUND', message: '书签不存在' })
    }
    const row = getMarkRow(found.db, id)
    if (!row || row.deleted_at !== null) {
      return err({ code: 'FILE_NOT_FOUND', message: '书签不存在' })
    }
    found.db.prepare('DELETE FROM marks WHERE id = ?').get(id)
    found.db
      .prepare('INSERT OR REPLACE INTO marks_tombstones (mark_id, deleted_at) VALUES (?, ?)')
      .get(id, Date.now())
    return ok(undefined)
  } catch (error) {
    return err(toAppError(error, '删除书签失败'))
  }
}
