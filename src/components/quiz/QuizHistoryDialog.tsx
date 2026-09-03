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
  History,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Trophy,
  Calendar,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { QuizSessionRecord } from '@shared/types/quiz'
import { defaultQuizRepository } from '@/lib/quiz/quiz-storage-jsonl'

export interface QuizHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookTitle: string
  filePath: string
  onNavigateToMark?: (markId: string) => void
  onRetryQuestion?: (passage: string, chapterTitle?: string, markId?: string) => void
}

export function QuizHistoryDialog({
  open,
  onOpenChange,
  bookTitle,
  filePath,
  onNavigateToMark,
  onRetryQuestion,
}: QuizHistoryDialogProps) {
  const [sessions, setSessions] = useState<QuizSessionRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let isMounted = true
    setLoading(true)

    defaultQuizRepository.getSessionsByFile(filePath).then((list) => {
      if (!isMounted) return
      setSessions(list)
      if (list.length > 0) {
        setSelectedId(list[0].id)
      } else {
        setSelectedId(null)
      }
      setLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [open, filePath])

  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number>(0)

  const currentSession = sessions.find((s) => s.id === selectedId)
  const activeQuestion = currentSession?.questions[activeQuestionIdx] || currentSession?.questions[0]
  const submission = activeQuestion ? currentSession?.submissions[activeQuestion.id] : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl bg-card/95 backdrop-blur-xl border border-border/80 shadow-2xl overflow-hidden p-6 max-h-[85vh] flex flex-col"
        aria-describedby="quiz-history-dialog-desc"
      >
        <DialogHeader className="border-b border-border/40 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <History className="size-4" />
            </span>
            <DialogTitle className="text-base font-semibold text-foreground tracking-tight">
              答题历史与成绩回放
            </DialogTitle>
          </div>
          <DialogDescription id="quiz-history-dialog-desc" className="text-xs text-muted-foreground line-clamp-1">
            《{bookTitle}》· 共 {sessions.length} 次测验记录 (JSONL 知识库)
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-xs text-muted-foreground">
            正在读取答题流式记录...
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-2 text-center">
            <Layers className="size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground/80">暂无测验记录</p>
            <p className="text-xs text-muted-foreground">
              在右侧批注栏选中任意段落，点击「🎯 AI 考考我」开始首次挑战吧！
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0 pt-2 overflow-hidden">
            {/* 左侧测验历史列表 */}
            <div className="md:col-span-1 border-r border-border/40 pr-3 overflow-y-auto space-y-2">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                测验轮次
              </div>
              {sessions.map((sess) => {
                const q = sess.questions[0]
                const isSelected = sess.id === selectedId
                const dateStr = new Date(sess.createdAt).toLocaleDateString('zh-CN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
                return (
                  <button
                    key={sess.id}
                    onClick={() => {
                      setSelectedId(sess.id)
                      setActiveQuestionIdx(0)
                    }}
                    className={cn(
                      'w-full text-left p-2.5 rounded-lg border transition-all flex flex-col gap-1',
                      isSelected
                        ? 'border-primary/50 bg-primary/10 shadow-sm'
                        : 'border-border/40 bg-muted/20 hover:bg-muted/40',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">
                        {sess.questions.length > 1 ? `试卷 (${sess.questions.length}题)` : q?.title || '深度思考测验'}
                      </span>
                      <span
                        className={cn(
                          'text-[10px] font-bold px-1.5 py-0.5 rounded',
                          sess.grade === 'A' && 'bg-emerald-500/20 text-emerald-500',
                          sess.grade === 'B' && 'bg-blue-500/20 text-blue-500',
                          sess.grade === 'C' && 'bg-amber-500/20 text-amber-500',
                          sess.grade === 'D' && 'bg-rose-500/20 text-rose-500',
                        )}
                      >
                        {sess.totalScore}分 · {sess.grade}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Calendar className="size-3" />
                      <span>{dateStr}</span>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* 右侧测验详情完整回放 (Replay) */}
            <div className="md:col-span-2 overflow-y-auto pl-1 pr-1 space-y-3 text-xs">
              {currentSession && activeQuestion && submission ? (
                <>
                  {/* 分数条 */}
                  <div className="p-3 rounded-xl border border-border/80 bg-muted/30 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="text-base font-bold text-foreground">
                        整卷得分：<span className="text-primary text-lg">{currentSession.totalScore}</span> / 100
                      </div>
                      <span
                        className={cn(
                          'text-[11px] font-bold px-2 py-0.5 rounded-full',
                          currentSession.grade === 'A' && 'bg-emerald-500/20 text-emerald-500',
                          currentSession.grade === 'B' && 'bg-blue-500/20 text-blue-500',
                          currentSession.grade === 'C' && 'bg-amber-500/20 text-amber-500',
                          currentSession.grade === 'D' && 'bg-rose-500/20 text-rose-500',
                        )}
                      >
                        等级 {currentSession.grade}
                      </span>
                    </div>

                    {onNavigateToMark && activeQuestion.markId ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 text-primary border-primary/40"
                        onClick={() => {
                          onOpenChange(false)
                          onNavigateToMark(activeQuestion.markId!)
                        }}
                      >
                        <BookOpen className="size-3" />
                        📖 查看原书
                      </Button>
                    ) : null}
                  </div>

                  {/* 多题题卡切换 */}
                  {currentSession.questions.length > 1 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      {currentSession.questions.map((q, idx) => {
                        const sub = currentSession.submissions[q.id]
                        return (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => setActiveQuestionIdx(idx)}
                            className={cn(
                              'px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors shrink-0 flex items-center gap-1',
                              activeQuestionIdx === idx
                                ? 'bg-primary/10 text-primary border-primary/40'
                                : 'bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/60',
                            )}
                          >
                            <span>第 {idx + 1} 题</span>
                            {sub ? <span className="font-mono font-bold">({sub.score}分)</span> : null}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* 题目 */}
                  <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-1">
                    <div className="font-semibold text-primary flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="size-3.5" />
                        <span>考题：{activeQuestion.title}</span>
                      </div>
                      {activeQuestion.tag ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          {activeQuestion.tag}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-foreground/90 font-medium leading-relaxed">
                      {activeQuestion.prompt}
                    </p>
                  </div>

                  {/* 读者手写作答 */}
                  <div className="space-y-1">
                    <div className="text-muted-foreground font-medium">你的原始回答：</div>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/60 text-foreground/90 leading-relaxed italic">
                      “{submission.userAnswer}”
                    </div>
                  </div>

                  {/* 采分点对比 */}
                  <div className="p-3 rounded-lg border border-border/60 bg-card/60 space-y-2">
                    <div className="font-semibold text-foreground flex items-center gap-1">
                      <Trophy className="size-3.5 text-amber-500" />
                      采分点比对：
                    </div>
                    <div className="space-y-1 text-[11px]">
                      {submission.hitKeyPoints.map((kp, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-emerald-500">
                          <CheckCircle2 className="size-3 shrink-0" />
                          <span>{kp}（已命中）</span>
                        </div>
                      ))}
                      {submission.missedKeyPoints.map((kp, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-amber-500">
                          <AlertCircle className="size-3 shrink-0" />
                          <span className="text-muted-foreground">{kp}（未答出）</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 导师评语 */}
                  <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-1 text-foreground/90 leading-relaxed">
                    <span className="font-semibold text-primary">导师评语：</span>
                    {submission.feedback}
                  </div>

                  {/* 底部重测按钮 */}
                  {onRetryQuestion && (
                    <div className="pt-2 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1"
                        onClick={() => {
                          onOpenChange(false)
                          onRetryQuestion(
                            activeQuestion.sourceExcerpt,
                            activeQuestion.chapterTitle,
                            activeQuestion.markId,
                          )
                        }}
                      >
                        重新挑战这道题
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-20 text-center text-muted-foreground">
                  请在左侧选择一次测验进行回放
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
