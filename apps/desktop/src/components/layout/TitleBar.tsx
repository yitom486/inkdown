import {
  AppWindow,
  Bug,
  Coffee,
  FileCode2,
  FileText,
  FolderOpen,
  HelpCircle,
  LogOut,
  Moon,
  PanelLeft,
  PanelLeftClose,
  Replace,
  Save,
  SaveAll,
  Search,
  Settings,
  Sun,
} from 'lucide-react'
import type { AppTheme } from '@/stores/editor-ui-store'
import { AgentMark } from '@/components/agent/AgentMark'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
  theme: AppTheme
  recentFiles: string[]
  sidebarVisible?: boolean
  agentPanelOpen?: boolean
  readOnly?: boolean
  onToggleTheme: () => void
  onSetTheme?: (theme: AppTheme) => void
  onToggleSidebar?: () => void
  onToggleAgentPanel?: () => void
  onOpenFile: () => void
  onOpenFolder: () => void
  onQuickOpen?: () => void
  onFind?: () => void
  onReplace?: () => void
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
  onSetTheme,
  onToggleSidebar,
  onToggleAgentPanel,
  onOpenFile,
  onOpenFolder,
  onQuickOpen,
  onFind,
  onReplace,
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
          {onQuickOpen && (
            <DropdownMenuItem onClick={onQuickOpen}>
              <Search className="size-4" />
              快速打开文件…
              <DropdownMenuShortcut>Ctrl+P</DropdownMenuShortcut>
            </DropdownMenuItem>
          )}
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          >
            编辑
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem disabled={readOnly || !onFind} onClick={onFind}>
            <Search className="size-4" />
            查找
            <DropdownMenuShortcut>Ctrl+F</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={readOnly || !onReplace} onClick={onReplace}>
            <Replace className="size-4" />
            替换
            <DropdownMenuShortcut>Ctrl+H</DropdownMenuShortcut>
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
            视图
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {onToggleSidebar ? (
            <DropdownMenuItem onClick={onToggleSidebar}>
              {sidebarVisible ? (
                <PanelLeftClose className="size-4" />
              ) : (
                <PanelLeft className="size-4" />
              )}
              {sidebarVisible ? '隐藏侧边栏' : '显示侧边栏'}
              <DropdownMenuShortcut>Ctrl+B</DropdownMenuShortcut>
            </DropdownMenuItem>
          ) : null}
          {onToggleAgentPanel ? (
            <DropdownMenuItem onClick={onToggleAgentPanel}>
              <AgentMark className="size-4" />
              {agentPanelOpen ? '隐藏 Agent 面板' : '显示 Agent 面板'}
              <DropdownMenuShortcut>Ctrl+Shift+A</DropdownMenuShortcut>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onToggleTheme}>
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            切换主题 (当前: {theme === 'light' ? '纸质白' : theme === 'sepia' ? '羊皮纸' : '极夜黑'})
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
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem onClick={onOpenSettings}>
            <Settings className="size-4" />
            设置...
            <DropdownMenuShortcut>Ctrl+,</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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

      <div className="ml-auto flex items-center gap-1.5">
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
            <AgentMark className="size-4" />
          </Button>
        ) : null}

        {/* 三态微晶主题胶囊选择器 (纸质白 / 羊皮纸暖调 / 石墨暗晶) */}
        <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/60">
          <button
            type="button"
            onClick={() => (onSetTheme ? onSetTheme('light') : onToggleTheme())}
            className={cn(
              'p-1 rounded-md transition-all cursor-pointer',
              theme === 'light'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground',
            )}
            title="纸质明亮模式"
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => (onSetTheme ? onSetTheme('sepia') : onToggleTheme())}
            className={cn(
              'p-1 rounded-md transition-all cursor-pointer',
              theme === 'sepia'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground',
            )}
            title="羊皮纸暖调模式"
          >
            <Coffee className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => (onSetTheme ? onSetTheme('dark') : onToggleTheme())}
            className={cn(
              'p-1 rounded-md transition-all cursor-pointer',
              theme === 'dark'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground',
            )}
            title="极夜深色模式"
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  )
}
