import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface AboutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  version: string
  platform: string
}

export function AboutDialog({
  open,
  onOpenChange,
  version,
  platform,
}: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>关于轻量阅读器</DialogTitle>
          <DialogDescription>
            版本 {version} · {platform} · Markdown 编辑与 PDF / EPUB 轻量阅读
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          基于 Electron + React + shadcn/ui 构建。
        </p>
      </DialogContent>
    </Dialog>
  )
}
