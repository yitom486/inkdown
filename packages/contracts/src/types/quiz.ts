export interface QuizQuestion {
  id: string
  title: string
  prompt: string
  tag?: string // 轻量认知分类标签（如：概念认知、逻辑因果、批判延伸等）
  keyPoints: string[]
  sourceExcerpt: string
  chapterTitle?: string
  markId?: string
}

export type QuizGrade = 'A' | 'B' | 'C' | 'D'

export interface QuizAnswerSubmission {
  questionId: string
  userAnswer: string
  score: number // 0 ~ 100
  grade: QuizGrade
  feedback: string
  hitKeyPoints: string[]
  missedKeyPoints: string[]
  gradedAt: string
}

export interface QuizSessionRecord {
  id: string
  bookTitle: string
  filePath: string
  chapterKey?: string
  chapterTitle?: string
  createdAt: string
  totalScore: number
  grade: QuizGrade
  questions: QuizQuestion[]
  submissions: Record<string, QuizAnswerSubmission>
}

export function calculateQuizGrade(score: number): QuizGrade {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  return 'D'
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
