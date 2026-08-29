import {
  AppWindow,
  Bot,
  Bug,
  FileCode2,
  FileText,
  FolderOpen,
  HelpCircle,
  LogOut,
  Moon,
  PanelLeft,
  PanelLeftClose,
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
  sidebarVisible?: boolean
  agentPanelOpen?: boolean
  readOnly?: boolean
  onToggleTheme: () => void
  onToggleSidebar?: () => void
  onToggleAgentPanel?: () => void
  onOpenFile: () => void
  onOpenFolder: () => void
  onOpenRecentFile: (path: string) => void
  onSave: () => void
  onSaveAs: () => void
  onExportHtml: () => void
  onExportPdf: () => void
  onOpenSettings: () => void
  onOpenErrorLog: () => void
  onOpenDevTools: () => void
  onAbout: () => void
  onNewWindow: () => void
  onQuit: () => void
}

export function TitleBar({
  theme,
  recentFiles,
  sidebarVisible = true,
  agentPanelOpen = false,
  readOnly = false,
  onToggleTheme,
  onToggleSidebar,
  onToggleAgentPanel,
  onOpenFile,
  onOpenFolder,
  onOpenRecentFile,
  onSave,
  onSaveAs,
  onExportHtml,
  onExportPdf,
  onOpenSettings,
  onOpenErrorLog,
  onOpenDevTools,
  onAbout,
  onNewWindow,
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
          <DropdownMenuItem onClick={onNewWindow}>
            <AppWindow className="size-4" />
            新建窗口
            <DropdownMenuShortcut>Ctrl+N</DropdownMenuShortcut>
          </DropdownMenuItem>
          {!readOnly && (
            <>
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
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onQuit}>
            <LogOut className="size-4" />
            退出
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {onToggleSidebar && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            >
              视图
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem onClick={onToggleSidebar}>
              {sidebarVisible ? (
                <PanelLeftClose className="size-4" />
              ) : (
                <PanelLeft className="size-4" />
              )}
              {sidebarVisible ? '隐藏侧栏' : '显示侧栏'}
              <DropdownMenuShortcut>Ctrl+B</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

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
          <DropdownMenuItem onClick={onOpenDevTools}>
            <Bug className="size-4" />
            开发者工具
            <DropdownMenuShortcut>Ctrl+Shift+I</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenErrorLog}>
            <FileText className="size-4" />
            错误日志
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onAbout}>
            <HelpCircle className="size-4" />
            关于
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-0.5">
        {onToggleAgentPanel ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className={
              agentPanelOpen
                ? 'bg-accent/40 text-foreground hover:bg-accent/60'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
            }
            aria-label={agentPanelOpen ? '关闭 Agent 面板' : '打开 Agent 面板'}
            aria-pressed={agentPanelOpen}
            title={agentPanelOpen ? '关闭 Agent (Ctrl+Shift+A)' : '打开 Agent (Ctrl+Shift+A)'}
            onClick={onToggleAgentPanel}
          >
            <Bot className="size-4" />
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          aria-label={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
          title={theme === 'dark' ? '浅色主题' : '深色主题'}
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </div>
    </header>
  )
}
