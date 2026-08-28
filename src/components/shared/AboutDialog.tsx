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
          <DialogTitle>关于 Markdown Editor</DialogTitle>
          <DialogDescription>
            版本 {version} · {platform}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          基于 Electron + React + shadcn/ui 构建的 Markdown 编辑器。
        </p>
      </DialogContent>
    </Dialog>
  )
}
