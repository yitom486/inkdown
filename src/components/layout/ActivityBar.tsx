import { Files } from 'lucide-react'
import { AgentMark } from '@/components/agent/AgentMark'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ActivityBarProps {
  sidebarVisible: boolean
  agentPanelOpen?: boolean
  onToggleSidebar: () => void
  onToggleAgentPanel?: () => void
}

/** 左侧活动栏：资源管理器 + Agent（VS Code / Cursor：活动栏在左，聊天停靠右侧） */
export function ActivityBar({
  sidebarVisible,
  agentPanelOpen = false,
  onToggleSidebar,
  onToggleAgentPanel,
}: ActivityBarProps) {
  return (
    <aside
      className="flex h-full w-12 shrink-0 flex-col items-center border-r border-border/60 bg-sidebar pt-1"
      aria-label="活动栏"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'size-10 rounded-none border-l-2 border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground',
          sidebarVisible && 'border-primary bg-accent/40 text-foreground',
        )}
        aria-label={sidebarVisible ? '隐藏资源管理器' : '显示资源管理器'}
        aria-pressed={sidebarVisible}
        title={sidebarVisible ? '隐藏资源管理器 (Ctrl+B)' : '显示资源管理器 (Ctrl+B)'}
        onClick={onToggleSidebar}
      >
        <Files className="size-5" />
      </Button>
      {onToggleAgentPanel ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'mt-auto mb-2 size-10 rounded-none border-l-2 border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            agentPanelOpen && 'border-primary bg-accent/40 text-foreground',
          )}
          aria-label={agentPanelOpen ? '关闭 Agent 面板' : '打开 Agent 面板'}
          aria-pressed={agentPanelOpen}
          title={agentPanelOpen ? '关闭 Agent (Ctrl+Shift+A)' : '打开 Agent (Ctrl+Shift+A)'}
          onClick={onToggleAgentPanel}
        >
          <AgentMark className="size-5" />
        </Button>
      ) : null}
    </aside>
  )
}
