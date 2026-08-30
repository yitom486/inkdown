import { useEffect, useState } from 'react'
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

/** 正式面板经 propose 提出草稿时的全局确认框（可编辑）。 */
export function AnnotationDraftConfirmHost() {
  const open = useAnnotationAgentStore((s) => s.externalProposeOpen)
  const draft = useAnnotationAgentStore((s) => s.pendingDraft)
  const updatePendingNote = useAnnotationAgentStore((s) => s.updatePendingNote)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (draft) setNote(draft.note)
  }, [draft])

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
          <DialogTitle>确认批注草稿</DialogTitle>
        </DialogHeader>
        {draft.excerpt ? (
          <blockquote className="max-h-20 overflow-y-auto border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground italic">
            {draft.excerpt}
          </blockquote>
        ) : null}
        <textarea
          value={note}
          onChange={(event) => {
            setNote(event.target.value)
            updatePendingNote(event.target.value)
          }}
          rows={5}
          className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="可直接修改后再采用…"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => dismissProposedNote()}>
            不要了
          </Button>
          <Button
            onClick={() => {
              void adoptProposedNote(note)
                .then(() => toast.success(note.trim() ? '已保存批注' : '已添加高亮'))
                .catch((cause) => {
                  toast.error(cause instanceof Error ? cause.message : '保存失败')
                })
            }}
          >
            采用并保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
