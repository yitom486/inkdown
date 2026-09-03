import { appendFile, mkdir, readFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import { toAppError, type AppError } from '@shared/core/errors'
import { err, ok, type Result } from '@shared/core/result'
import type { QuizSessionRecord } from '@shared/types/quiz'

function getQuizFilePath(): string {
  return join(app.getPath('userData'), 'quiz-records.jsonl')
}

function normalizeFilePath(filePath: string): string {
  const trimmed = filePath.trim()
  if (process.platform === 'win32') {
    return trimmed.toLowerCase()
  }
  return trimmed
}

/**
 * 序列化单条测验记录为单行 JSON
 */
export function serializeQuizSession(session: QuizSessionRecord): string {
  return `${JSON.stringify(session)}\n`
}

/**
 * 解析 JSONL 文本为 QuizSessionRecord 列表（容错跳过损坏行）
 */
export function parseQuizJsonl(raw: string): QuizSessionRecord[] {
  const lines = raw.split('\n')
  const records: QuizSessionRecord[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const parsed = JSON.parse(trimmed) as QuizSessionRecord
      if (parsed && typeof parsed === 'object' && parsed.id && Array.isArray(parsed.questions)) {
        records.push(parsed)
      }
    } catch {
      // 容错跳过损坏行
    }
  }

  return records
}

/**
 * 追加一条测验记录到 JSONL
 */
export async function appendQuizSession(
  session: QuizSessionRecord,
): Promise<Result<void, AppError>> {
  try {
    const filePath = getQuizFilePath()
    await mkdir(app.getPath('userData'), { recursive: true })
    await appendFile(filePath, serializeQuizSession(session), 'utf-8')
    return ok(undefined)
  } catch (error) {
    return err(toAppError(error, '测验记录保存失败'))
  }
}

/**
 * 读取全部测验历史记录（倒序排列，最新优先）
 */
export async function readAllQuizSessions(): Promise<Result<QuizSessionRecord[], AppError>> {
  try {
    const filePath = getQuizFilePath()
    const raw = await readFile(filePath, 'utf-8').catch((e: unknown) => {
      if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'ENOENT') {
        return ''
      }
      throw e
    })

    const records = parseQuizJsonl(raw)
    // 按时间倒序
    records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return ok(records)
  } catch (error) {
    return err(toAppError(error, '读取测验记录失败'))
  }
}

/**
 * 按书籍/文档路径读取测验历史
 */
export async function readQuizSessionsByFile(
  filePath: string,
): Promise<Result<QuizSessionRecord[], AppError>> {
  const allResult = await readAllQuizSessions()
  if (!allResult.ok) return allResult

  const targetPath = normalizeFilePath(filePath)
  const filtered = allResult.value.filter(
    (record) => normalizeFilePath(record.filePath) === targetPath,
  )
  return ok(filtered)
}
