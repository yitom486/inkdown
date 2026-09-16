import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { getDraftDisplayName, type DocumentDraft } from '@/lib/editor/draft-utils'

interface DraftRecoveryDialogProps {
  open: boolean
  draft: DocumentDraft | null
  onRestore: () => void
  onDiscard: () => void
}

export function DraftRecoveryDialog({
  open,
  draft,
  onRestore,
  onDiscard,
}: DraftRecoveryDialogProps) {
  if (!draft) return null

  const displayName = getDraftDisplayName(draft)
  const updatedAt = new Date(draft.updatedAt).toLocaleString()

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>发现未保存的草稿</AlertDialogTitle>
          <AlertDialogDescription>
            「{displayName}」在上次异常退出前仍有未保存内容（{updatedAt}）。是否恢复？
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={onDiscard}>
            丢弃
          </Button>
          <Button onClick={onRestore}>恢复草稿</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
