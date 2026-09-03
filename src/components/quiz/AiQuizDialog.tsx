import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Sparkles,
  BookOpen,
  CheckCircle2,
  XCircle,
  Trophy,
  RotateCcw,
  Send,
  Loader2,
  AlertCircle,
  History,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { QuizAnswerSubmission, QuizQuestion, QuizSessionRecord } from '@shared/types/quiz'
import {
  evaluateFallbackAnswer,
  generateFallbackQuestion,
} from '@/lib/quiz/quiz-evaluator'
import { defaultQuizRepository } from '@/lib/quiz/quiz-storage-jsonl'
import { toast } from 'sonner'

export interface AiQuizDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  passage: string
  bookTitle: string
  filePath: string
  chapterTitle?: string
  markId?: string
  onNavigateToMark?: (markId: string) => void
  onOpenHistory?: () => void
}

type DialogPhase = 'generating' | 'answering' | 'grading' | 'result'

export function AiQuizDialog({
  open,
  onOpenChange,
  passage,
  bookTitle,
  filePath,
  chapterTitle,
  markId,
  onNavigateToMark,
  onOpenHistory,
}: AiQuizDialogProps) {
  const [phase, setPhase] = useState<DialogPhase>('generating')
  const [question, setQuestion] = useState<QuizQuestion | null>(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [submission, setSubmission] = useState<QuizAnswerSubmission | null>(null)

  // 当弹窗打开时，自动触发出题
  useEffect(() => {
    if (!open) {
      setPhase('generating')
      setQuestion(null)
      setUserAnswer('')
      setSubmission(null)
      return
    }

    let isMounted = true
    setPhase('generating')

    const timer = setTimeout(() => {
      if (!isMounted) return
      const q = generateFallbackQuestion(passage, chapterTitle, markId)
      setQuestion(q)
      setPhase('answering')
    }, 600)

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [open, passage, chapterTitle, markId])

  // 提交作答进行判卷
  const handleSubmitAnswer = async () => {
    if (!question) return
    const trimmed = userAnswer.trim()
    if (!trimmed) {
      toast.warning('请输入你的回答或思考后再提交判卷')
      return
    }

    setPhase('grading')

    setTimeout(async () => {
      const result = evaluateFallbackAnswer(question, trimmed)
      const sub: QuizAnswerSubmission = {
        questionId: question.id,
        userAnswer: trimmed,
        score: result.score,
        grade: result.grade,
        feedback: result.feedback,
        hitKeyPoints: result.hitKeyPoints,
        missedKeyPoints: result.missedKeyPoints,
        gradedAt: new Date().toISOString(),
      }
      setSubmission(sub)

      // 保存到本地 JSONL 仓储
      const sessionRecord: QuizSessionRecord = {
        id: `session-${Date.now()}`,
        bookTitle,
        filePath,
        chapterTitle,
        createdAt: new Date().toISOString(),
        totalScore: sub.score,
        grade: sub.grade,
        questions: [question],
        submissions: {
          [question.id]: sub,
        },
      }

      await defaultQuizRepository.appendSession(sessionRecord)
      setPhase('result')
      toast.success(`AI 判卷完成！得分：${sub.score} 分 (${sub.grade})`)
    }, 900)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl bg-card/95 backdrop-blur-xl border border-border/80 shadow-2xl overflow-hidden p-6"
        aria-describedby="ai-quiz-dialog-desc"
      >
        <DialogHeader className="border-b border-border/40 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="size-4" />
              </span>
              <DialogTitle className="text-base font-semibold text-foreground tracking-tight">
                AI 伴读考官 · 深度思考提问
              </DialogTitle>
            </div>
            {onOpenHistory ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  onOpenChange(false)
                  onOpenHistory()
                }}
              >
                <History className="size-3.5" />
                历史成绩回放
              </Button>
            ) : null}
          </div>
          <DialogDescription id="ai-quiz-dialog-desc" className="text-xs text-muted-foreground line-clamp-1">
            《{bookTitle}》· {chapterTitle || '当前章节'}
          </DialogDescription>
        </DialogHeader>

        {/* 阶段 1：AI 正在提炼出题 */}
        {phase === 'generating' && (
          <div className="py-16 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground/80">
              AI 考官正在研读划线段落，提炼深度考点...
            </p>
            <p className="text-xs text-muted-foreground">
              提炼主旨意图与因果关系，而非死记硬背
            </p>
          </div>
        )}

        {/* 阶段 2：读者作答界面 */}
        {phase === 'answering' && question && (
          <div className="space-y-4 py-2">
            {/* 考题卡片 */}
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                  {question.title}
                </span>
                <span className="text-xs text-muted-foreground">启发思考题</span>
              </div>
              <p className="text-sm font-medium text-foreground leading-relaxed">
                {question.prompt}
              </p>
            </div>

            {/* 原文微缩引述 */}
            <div className="px-3 py-2 rounded-lg bg-muted/30 border border-border/40 text-xs text-muted-foreground italic line-clamp-2">
              “{question.sourceExcerpt}”
            </div>

            {/* 作答输入区 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>你的回答与理解：</span>
                <span>{userAnswer.length} 字</span>
              </div>
              <textarea
                value={userAnswer}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setUserAnswer(e.target.value)}
                placeholder="请用自己的语言阐明核心观点、原因或逻辑推论... (按 Ctrl+Enter 快速提交)"
                className="w-full rounded-md border border-input bg-muted/20 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[120px] resize-none leading-relaxed"
                onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    handleSubmitAnswer()
                  }
                }}
              />
            </div>

            {/* 底部操作条 */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-muted-foreground/70">
                可结合原书前后逻辑作答，字数不限
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="text-xs"
                >
                  稍后再答
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="text-xs gap-1.5 bg-primary text-primary-foreground"
                  onClick={handleSubmitAnswer}
                >
                  <Send className="size-3.5" />
                  提交 AI 判卷
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 阶段 3：AI 判卷评分中 */}
        {phase === 'grading' && (
          <div className="py-16 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="size-8 animate-spin text-emerald-500" />
            <p className="text-sm font-medium text-foreground/80">
              AI 导师正在比对原书论述与采分要点...
            </p>
            <p className="text-xs text-muted-foreground">
              正在分析采分点命中率并组织指导性评语
            </p>
          </div>
        )}

        {/* 阶段 4：判卷结果与深度复盘 */}
        {phase === 'result' && submission && question && (
          <div className="space-y-4 py-2">
            {/* 分数与等级看板 */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-border/80 bg-gradient-to-r from-card to-muted/30">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold text-lg border shadow-sm',
                    submission.grade === 'A' &&
                      'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
                    submission.grade === 'B' &&
                      'bg-blue-500/10 text-blue-500 border-blue-500/30',
                    submission.grade === 'C' &&
                      'bg-amber-500/10 text-amber-500 border-amber-500/30',
                    submission.grade === 'D' &&
                      'bg-rose-500/10 text-rose-500 border-rose-500/30',
                  )}
                >
                  {submission.grade}
                </div>
                <div>
                  <div className="text-xl font-bold text-foreground">
                    {submission.score} <span className="text-xs font-normal text-muted-foreground">/ 100 分</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    已录入个人知识掌握档案 (JSONL)
                  </div>
                </div>
              </div>

              {/* 原书回跳按钮 */}
              {onNavigateToMark && question.markId ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 text-primary border-primary/40 hover:bg-primary/10"
                  onClick={() => {
                    onOpenChange(false)
                    onNavigateToMark(question.markId!)
                  }}
                >
                  <BookOpen className="size-3.5" />
                  📖 查看原书证据
                </Button>
              ) : null}
            </div>

            {/* 采分点对比 */}
            <div className="space-y-2 p-3.5 rounded-xl border border-border/60 bg-muted/20 text-xs">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <Trophy className="size-3.5 text-amber-500" />
                采分点比对清单：
              </div>
              <div className="space-y-1.5 pt-1">
                {submission.hitKeyPoints.map((kp, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-emerald-500">
                    <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" />
                    <span className="text-foreground/90">{kp}（已准确涵盖）</span>
                  </div>
                ))}
                {submission.missedKeyPoints.map((kp, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-amber-500">
                    <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{kp}（原书关键要点，建议深化）</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 导师评语 */}
            <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-1 text-xs">
              <div className="font-semibold text-primary flex items-center gap-1">
                <Sparkles className="size-3.5" />
                导师评语与启发：
              </div>
              <p className="text-foreground/85 leading-relaxed">
                {submission.feedback}
              </p>
            </div>

            {/* 底部按钮 */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1"
                onClick={() => {
                  setPhase('answering')
                  setUserAnswer('')
                }}
              >
                <RotateCcw className="size-3.5" />
                重新作答这题
              </Button>
              <Button
                variant="default"
                size="sm"
                className="text-xs px-5"
                onClick={() => onOpenChange(false)}
              >
                完成
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
