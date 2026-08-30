import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  adoptProposedNote,
  dismissProposedNote,
} from '@/lib/agent/context/propose-note-for-agent'
import { useAnnotationAgentStore } from '@/stores/annotation-agent-store'

/** 正式 Agent 经 propose MCP 提出草稿时的全局确认框（与划选对话框共用 pendingDraft）。 */
export function AnnotationDraftConfirmHost() {
  const open = useAnnotationAgentStore((s) => s.externalProposeOpen)
  const draft = useAnnotationAgentStore((s) => s.pendingDraft)

  if (!open || !draft) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismissProposedNote()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>确认 Agent 批注草稿</DialogTitle>
        </DialogHeader>
        {draft.excerpt ? (
          <blockquote className="max-h-20 overflow-y-auto border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground italic">
            {draft.excerpt}
          </blockquote>
        ) : null}
        <div className="max-h-48 overflow-y-auto rounded-md border border-border/80 bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap">
          {draft.note || '（空批注 = 仅高亮）'}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => dismissProposedNote()}>
            不要了
          </Button>
          <Button
            onClick={() => {
              void adoptProposedNote(draft.note)
                .then(() => toast.success(draft.note.trim() ? '已保存批注' : '已添加高亮'))
                .catch((cause) => {
                  toast.error(cause instanceof Error ? cause.message : '保存失败')
                })
            }}
          >
            采用
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
