import {
  FileCode2,
  FileText,
  FolderOpen,
  HelpCircle,
  LogOut,
  Moon,
  Save,
  SaveAll,
  Settings,
  Sun,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function getRecentFileLabel(filePath: string): string {
  return filePath.split(/[/\\]/).pop() ?? filePath
}

interface TitleBarProps {
  theme: 'dark' | 'light'
  recentFiles: string[]
  onToggleTheme: () => void
  onOpenFile: () => void
  onOpenFolder: () => void
  onOpenRecentFile: (path: string) => void
  onSave: () => void
  onSaveAs: () => void
  onExportHtml: () => void
  onExportPdf: () => void
  onOpenSettings: () => void
  onAbout: () => void
  onQuit: () => void
}

export function TitleBar({
  theme,
  recentFiles,
  onToggleTheme,
  onOpenFile,
  onOpenFolder,
  onOpenRecentFile,
  onSave,
  onSaveAs,
  onExportHtml,
  onExportPdf,
  onOpenSettings,
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
        <DropdownMenuContent align="start" className="w-56">
          {recentFiles.length > 0 && (
            <>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>最近打开</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-w-sm">
                  {recentFiles.map((path) => (
                    <DropdownMenuItem key={path} onClick={() => onOpenRecentFile(path)} title={path}>
                      <span className="truncate">{getRecentFileLabel(path)}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
            </>
          )}
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
          <DropdownMenuItem onClick={onExportHtml}>
            <FileCode2 className="size-4" />
            导出 HTML
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExportPdf}>
            <FileText className="size-4" />
            导出 PDF
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
          <DropdownMenuItem onClick={onOpenSettings}>
            <Settings className="size-4" />
            设置
            <DropdownMenuShortcut>Ctrl+,</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAbout}>
            <HelpCircle className="size-4" />
            关于
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon-sm"
        className="ml-auto text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        aria-label={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
        title={theme === 'dark' ? '浅色主题' : '深色主题'}
        onClick={onToggleTheme}
      >
        {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
    </header>
  )
}
