import { FileText, FolderOpen, HelpCircle, LogOut, Save, SaveAll } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface TitleBarProps {
  onOpenFile: () => void
  onOpenFolder: () => void
  onSave: () => void
  onSaveAs: () => void
  onAbout: () => void
  onQuit: () => void
}

export function TitleBar({
  onOpenFile,
  onOpenFolder,
  onSave,
  onSaveAs,
  onAbout,
  onQuit,
}: TitleBarProps) {
  return (
    <header className="flex h-9 shrink-0 items-center gap-0.5 border-b border-border/60 bg-sidebar px-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          >
            文件
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem onClick={onOpenFile}>
            <FileText className="size-4" />
            打开文件
            <DropdownMenuShortcut>Ctrl+O</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenFolder}>
            <FolderOpen className="size-4" />
            打开文件夹
            <DropdownMenuShortcut>Ctrl+Shift+O</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onSave}>
            <Save className="size-4" />
            保存
            <DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onSaveAs}>
            <SaveAll className="size-4" />
            另存为
            <DropdownMenuShortcut>Ctrl+Shift+S</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onQuit}>
            <LogOut className="size-4" />
            退出
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          >
            帮助
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={onAbout}>
            <HelpCircle className="size-4" />
            关于
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
