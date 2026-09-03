import type { QuizSessionRecord } from '@shared/types/quiz'
import type { Result } from '@shared/core/result'
import type { AppError } from '@shared/core/errors'

export interface IQuizRepository {
  appendSession(session: QuizSessionRecord): Promise<Result<void, AppError>>
  getSessionsByFile(filePath: string): Promise<QuizSessionRecord[]>
  getAllSessions(): Promise<QuizSessionRecord[]>
  getSessionById(sessionId: string): Promise<QuizSessionRecord | null>
}
