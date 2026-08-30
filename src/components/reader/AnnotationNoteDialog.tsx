import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'

interface AnnotationNoteDialogProps {
  open: boolean
  excerpt?: string
  initialNote?: string
  title?: string
  onOpenChange: (open: boolean) => void
  onSave: (note: string) => void
}

export function AnnotationNoteDialog({
  open,
  excerpt,
  initialNote = '',
  title = '添加批注',
  onOpenChange,
  onSave,
}: AnnotationNoteDialogProps) {
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) {
      setNote(initialNote)
    }
  }, [open, excerpt, initialNote])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {excerpt ? (
          <blockquote className="border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground italic">
            {excerpt}
          </blockquote>
        ) : null}
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="写下你的想法…"
          rows={4}
          autoFocus
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={() => {
              onSave(note.trim())
              onOpenChange(false)
            }}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
