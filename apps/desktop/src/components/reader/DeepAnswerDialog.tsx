import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MarkdownContent } from '@/components/markdown/MarkdownContent'
import { renderAgentMarkdown } from '@/lib/agent/agent-markdown'
import { Check, Copy, Loader2, RotateCcw, Sparkles, StickyNote } from 'lucide-react'

/**
 * 一键深度问答对话框（P2）：答案直答选段，同制卡走一书一会话，
 * 不进右侧时间线；可一键存为批注卡片进 P1 落卡链。
 */
export interface DeepAnswerData {
  directionLabel: string
  excerpt: string
  answer: string
}

export function DeepAnswerDialog({
  data,
  pending,
  onClose,
  onRetry,
  onSaveAsNote,
}: {
  data: DeepAnswerData | null
  pending: boolean
  onClose: () => void
  onRetry: () => void
  onSaveAsNote: () => void
}) {
  const [copied, setCopied] = useState(false)
  const html = useMemo(
    () => (data && data.answer.trim() ? renderAgentMarkdown(data.answer) : ''),
    [data],
  )

  const handleCopy = async () => {
    if (!data?.answer.trim()) return
    try {
      await navigator.clipboard.writeText(data.answer.trim())
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // 剪贴板不可用时静默（Electron 沙盒极罕见）
    }
  }

  return (
    <Dialog open={data !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl bg-card/95 backdrop-blur-xl border-border/80 shadow-2xl p-6 max-h-[85vh] flex flex-col">
        <DialogHeader className="gap-1.5 pb-2 shrink-0">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Sparkles className="size-4 text-primary" />
            深度问答 · {data?.directionLabel ?? ''}
          </DialogTitle>
          <DialogDescription className="sr-only">AI 深度问答直答选段</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-3">
          {data ? (
            <blockquote className="border-l-2 border-primary/50 pl-3 py-1 text-xs text-muted-foreground italic leading-relaxed bg-muted/20 rounded-r line-clamp-4">
              {data.excerpt}
            </blockquote>
          ) : null}

          {pending || !data?.answer.trim() ? (
            <div className="py-10 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span>AI 正在研读作答…</span>
            </div>
          ) : (
            <MarkdownContent
              html={html}
              className="markdown-preview agent-md text-sm leading-relaxed"
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            disabled={pending || !data?.answer.trim()}
            onClick={handleCopy}
          >
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            {copied ? '已复制' : '复制'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            disabled={pending}
            onClick={onRetry}
          >
            <RotateCcw className="size-3.5" />
            换一版
          </Button>
          <Button
            variant="default"
            size="sm"
            className="h-8 text-xs gap-1.5"
            disabled={pending || !data?.answer.trim()}
            onClick={onSaveAsNote}
          >
            <StickyNote className="size-3.5" />
            存为卡片批注
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
