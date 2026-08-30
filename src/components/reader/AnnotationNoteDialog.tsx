import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  ANNOTATION_INTENT_CHIPS,
  ANNOTATION_REFINE_CHIPS,
  type AnnotationIntentId,
} from '@/lib/agent/annotation-note-prompts'
import { useAnnotationAgentAssist } from '@/hooks/agent/useAnnotationAgentAssist'
import {
  selectAnnotationActiveMessages,
  useAnnotationAgentStore,
} from '@/stores/annotation-agent-store'
import { groupAgentMessages } from '@/components/agent/AgentActivityGroup'
import { AgentMessageBubble } from '@/components/agent/AgentMessageBubble'
import { toast } from 'sonner'

interface AnnotationNoteDialogProps {
  open: boolean
  excerpt?: string
  initialNote?: string
  title?: string
  filePath: string
  fileFingerprint?: string
  /** 编辑已有批注时关闭 AI 助手主路径，保留手写 */
  aiAssist?: boolean
  onOpenChange: (open: boolean) => void
  onSave: (note: string) => void
}

export function AnnotationNoteDialog({
  open,
  excerpt = '',
  initialNote = '',
  title = '添加批注',
  filePath,
  fileFingerprint = '',
  aiAssist = true,
  onOpenChange,
  onSave,
}: AnnotationNoteDialogProps) {
  const [note, setNote] = useState('')
  const [showAi, setShowAi] = useState(true)
  const [customOpen, setCustomOpen] = useState(false)
  const [customText, setCustomText] = useState('')
  const [manualEdit, setManualEdit] = useState(false)

  const assist = useAnnotationAgentAssist({
    filePath,
    fileFingerprint,
    excerpt,
  })

  const messages = useAnnotationAgentStore(
    useShallow((s) => selectAnnotationActiveMessages(s)),
  )
  const timelineOpen = useAnnotationAgentStore((s) => s.timelineOpen)
  const setTimelineOpen = useAnnotationAgentStore((s) => s.setTimelineOpen)

  useEffect(() => {
    if (!open) return
    setNote(initialNote)
    setShowAi(aiAssist && !initialNote.trim())
    setCustomOpen(false)
    setCustomText('')
    setManualEdit(false)
    assist.prepare()
    // 仅在打开时初始化
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open edge
  }, [open, excerpt, initialNote, aiAssist])

  useEffect(() => {
    if (assist.pendingDraft && assist.phase === 'ready') {
      setNote(assist.pendingDraft.note)
      setManualEdit(false)
    }
  }, [assist.pendingDraft, assist.phase])

  const draftPreview =
    assist.pendingDraft?.note ??
    (assist.phase === 'generating' ? '正在生成…' : '')

  const handleIntent = async (id: AnnotationIntentId) => {
    if (id === 'custom') {
      setCustomOpen(true)
      return
    }
    if (!assist.agentReady) {
      toast.message('请先连接右侧 Agent，再使用 AI 写批注')
      return
    }
    await assist.runIntent(id)
  }

  const handleCustomSend = async () => {
    if (!customText.trim()) return
    if (!assist.agentReady) {
      toast.message('请先连接右侧 Agent，再使用 AI 写批注')
      return
    }
    await assist.runIntent('custom', customText)
    setCustomOpen(false)
  }

  const handleAdopt = () => {
    const text = (assist.pendingDraft?.note ?? note).trim()
    onSave(text)
    assist.discardDraft()
    onOpenChange(false)
  }

  const handleDiscardAi = () => {
    assist.discardDraft()
    setManualEdit(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-3 overflow-hidden sm:max-w-lg">
        <DialogHeader className="space-y-1">
          <DialogTitle>{title}</DialogTitle>
          {aiAssist ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={showAi ? 'secondary' : 'ghost'}
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => setShowAi((value) => !value)}
              >
                <Sparkles className="size-3.5" />
                {showAi ? '收起 AI' : '用 AI 写'}
              </Button>
              {showAi ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  disabled={assist.busy}
                  onClick={() => assist.newSession()}
                >
                  新会话
                </Button>
              ) : null}
            </div>
          ) : null}
        </DialogHeader>

        {excerpt ? (
          <blockquote className="max-h-24 shrink-0 overflow-y-auto border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground italic">
            {excerpt}
          </blockquote>
        ) : null}

        {showAi && aiAssist ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            {!assist.pendingDraft && assist.phase !== 'generating' ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">选一个意图即可生成草稿</p>
                <div className="flex flex-wrap gap-1.5">
                  {ANNOTATION_INTENT_CHIPS.map((chip) => (
                    <Button
                      key={chip.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-full px-2.5 text-xs"
                      disabled={assist.busy}
                      onClick={() => void handleIntent(chip.id)}
                    >
                      {chip.label}
                    </Button>
                  ))}
                </div>
                {customOpen ? (
                  <div className="flex gap-2">
                    <input
                      value={customText}
                      onChange={(event) => setCustomText(event.target.value)}
                      placeholder="一句话说明你想要的批注…"
                      className="flex h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void handleCustomSend()
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-8"
                      disabled={assist.busy || !customText.trim()}
                      onClick={() => void handleCustomSend()}
                    >
                      发送
                    </Button>
                  </div>
                ) : null}
                {!assist.agentReady ? (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    Agent 未连接时仍可在下方手写批注。
                  </p>
                ) : null}
              </div>
            ) : null}

            {assist.phase === 'generating' || assist.pendingDraft ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">待确认草稿</p>
                {manualEdit ? (
                  <textarea
                    value={note}
                    onChange={(event) => {
                      setNote(event.target.value)
                      assist.updatePendingNote(event.target.value)
                    }}
                    rows={4}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                ) : (
                  <div
                    className={cn(
                      'rounded-md border border-border/80 bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap',
                      assist.phase === 'generating' && 'text-muted-foreground',
                    )}
                  >
                    {draftPreview || '…'}
                  </div>
                )}

                {assist.phase !== 'generating' && assist.pendingDraft ? (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 rounded-full px-3 text-xs"
                        disabled={assist.busy}
                        onClick={handleAdopt}
                      >
                        采用
                      </Button>
                      {ANNOTATION_REFINE_CHIPS.map((chip) => (
                        <Button
                          key={chip.id}
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-full px-2.5 text-xs"
                          disabled={assist.busy}
                          onClick={() => void assist.runRefine(chip.id)}
                        >
                          {chip.label}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 rounded-full px-2.5 text-xs text-muted-foreground"
                        disabled={assist.busy}
                        onClick={handleDiscardAi}
                      >
                        不要了
                      </Button>
                    </div>
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() => setManualEdit((value) => !value)}
                    >
                      {manualEdit ? '收起编辑' : '自己改'}
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              className="flex items-center gap-1 text-[11px] text-muted-foreground"
              onClick={() => setTimelineOpen(!timelineOpen)}
            >
              {timelineOpen ? (
                <ChevronUp className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
              对话记录
            </button>
            {timelineOpen ? (
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border/60 p-2">
                {messages.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">尚无消息</p>
                ) : (
                  groupAgentMessages(messages).map((item) =>
                    item.type === 'activity' ? (
                      <div
                        key={item.messages.map((m) => m.id).join('-')}
                        className="space-y-1 opacity-80"
                      >
                        {item.messages.map((message) => (
                          <AgentMessageBubble key={message.id} message={message} />
                        ))}
                      </div>
                    ) : (
                      <AgentMessageBubble key={item.message.id} message={item.message} />
                    ),
                  )
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {!showAi || !aiAssist || (!assist.pendingDraft && assist.phase !== 'generating') ? (
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="写下你的想法…"
            rows={4}
            autoFocus={!showAi || !aiAssist}
            className="flex min-h-[80px] w-full shrink-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        ) : null}

        <DialogFooter className="shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          {assist.pendingDraft && assist.phase !== 'generating' ? (
            <Button onClick={handleAdopt} disabled={!draftPreview.trim()}>
              采用并保存
            </Button>
          ) : (
            <Button
              onClick={() => {
                onSave(note.trim())
                onOpenChange(false)
              }}
            >
              保存
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
