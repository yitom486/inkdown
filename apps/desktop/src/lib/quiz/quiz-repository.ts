import type { QuizSessionRecord } from '@inkdown/contracts'
import type { Result } from '@inkdown/contracts'
import type { AppError } from '@inkdown/contracts'

export interface IQuizRepository {
  appendSession(session: QuizSessionRecord): Promise<Result<void, AppError>>
  getSessionsByFile(filePath: string): Promise<QuizSessionRecord[]>
  getAllSessions(): Promise<QuizSessionRecord[]>
  getSessionById(sessionId: string): Promise<QuizSessionRecord | null>
}
