import { Files } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ActivityBarProps {
  sidebarVisible: boolean
  onToggleSidebar: () => void
}

/** 左侧活动栏：侧栏隐藏后仍保留入口，点击可再次打开（类似 VS Code） */
export function ActivityBar({ sidebarVisible, onToggleSidebar }: ActivityBarProps) {
  return (
    <aside
      className="flex w-12 shrink-0 flex-col items-center border-r border-border/60 bg-sidebar pt-1"
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
    </aside>
  )
}
