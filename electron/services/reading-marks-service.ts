import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { app } from 'electron'
import { toAppError, type AppError } from '@shared/core/errors'
import { err, ok, type Result } from '@shared/core/result'
import type {
  CreateReadingMarkPayload,
  ReadingMark,
  UpdateReadingMarkPayload,
} from '@shared/types/reading-mark'

interface ReadingMarksFile {
  marks: ReadingMark[]
}

function getMarksFilePath(): string {
  return join(app.getPath('userData'), 'reading-marks.json')
}

async function readStore(): Promise<ReadingMarksFile> {
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

async function writeStore(store: ReadingMarksFile): Promise<void> {
  const filePath = getMarksFilePath()
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(store, null, 2)}\n`, 'utf-8')
}

function normalizeMarkFilePath(filePath: string): string {
  const trimmed = filePath.trim()
  if (process.platform === 'win32') {
    return trimmed.toLowerCase()
  }
  return trimmed
}

export async function listReadingMarks(
  filePath?: string,
): Promise<Result<ReadingMark[], AppError>> {
  try {
    const store = await readStore()
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

    const now = Date.now()
    const mark: ReadingMark = {
      id: randomUUID(),
      filePath,
      fileFingerprint: payload.fileFingerprint,
      kind: payload.kind,
      anchor: payload.anchor,
      label: payload.label?.trim() || undefined,
      note: payload.note?.trim() || undefined,
      excerpt: payload.excerpt?.trim() || undefined,
      color: payload.color,
      createdAt: now,
      updatedAt: now,
    }

    const store = await readStore()
    store.marks.push(mark)
    await writeStore(store)
    return ok(mark)
  } catch (error) {
    return err(toAppError(error, '创建书签失败'))
  }
}

export async function updateReadingMark(
  payload: UpdateReadingMarkPayload,
): Promise<Result<ReadingMark, AppError>> {
  try {
    const store = await readStore()
    const index = store.marks.findIndex((mark) => mark.id === payload.id)
    if (index === -1) {
      return err({ code: 'FILE_NOT_FOUND', message: '书签不存在' })
    }

    const current = store.marks[index]!
    const next: ReadingMark = {
      ...current,
      label: payload.label !== undefined ? payload.label.trim() || undefined : current.label,
      note: payload.note !== undefined ? payload.note.trim() || undefined : current.note,
      color: payload.color ?? current.color,
      updatedAt: Date.now(),
    }
    store.marks[index] = next
    await writeStore(store)
    return ok(next)
  } catch (error) {
    return err(toAppError(error, '更新书签失败'))
  }
}

export async function deleteReadingMark(id: string): Promise<Result<void, AppError>> {
  try {
    const store = await readStore()
    const nextMarks = store.marks.filter((mark) => mark.id !== id)
    if (nextMarks.length === store.marks.length) {
      return err({ code: 'FILE_NOT_FOUND', message: '书签不存在' })
    }
    await writeStore({ marks: nextMarks })
    return ok(undefined)
  } catch (error) {
    return err(toAppError(error, '删除书签失败'))
  }
}
