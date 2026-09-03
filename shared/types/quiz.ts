export interface QuizQuestion {
  id: string
  title: string
  prompt: string
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
