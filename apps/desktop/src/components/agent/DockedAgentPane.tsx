import { memo, useEffect, useRef, useState } from 'react'
import { AgentPanel } from '@/components/agent/AgentPanel'
import { useReaderHudUiStore } from '@/stores/acp/reader-hud-store'
import { cn } from '@/lib/utils'

/**
 * 阅读器内停靠态 Agent 面板（含左侧拉伸分隔线）。
 *此前三端 viewer 各自写死 `w-[340px] shrink-0`，侧栏聊天框无法左右拉伸；
 * 此处统一为可拖拽宽度（280~640，持久化），三端共用。
 */
export const DockedAgentPane = memo(function DockedAgentPane({
  workspaceRoot,
}: {
  workspaceRoot?: string
}) {
  const width = useReaderHudUiStore((s) => s.dockedAgentWidth)
  const setWidth = useReaderHudUiStore((s) => s.setDockedAgentWidth)
  const [resizing, setResizing] = useState(false)
  const resizeRef = useRef<{ startX: number; width: number } | null>(null)

  useEffect(() => {
    if (!resizing) return
    const handleMove = (e: MouseEvent) => {
      if (!resizeRef.current) return
      // 左边缘手柄：往左拖变宽，往右拖变窄
      setWidth(resizeRef.current.width + (resizeRef.current.startX - e.clientX))
    }
    const handleUp = () => {
      setResizing(false)
      resizeRef.current = null
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', handleMove, { passive: true })
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      document.body.style.userSelect = ''
    }
  }, [resizing, setWidth])

  return (
    <div
      className="flex h-full min-h-0 shrink-0"
      style={{ width }}
      data-testid="docked-agent-pane"
    >
      <div
        data-testid="docked-agent-resize-handle"
        title="拖拽调整面板宽度"
        onMouseDown={(e) => {
          e.stopPropagation()
          e.preventDefault()
          setResizing(true)
          resizeRef.current = { startX: e.clientX, width }
          document.body.style.userSelect = 'none'
        }}
        className={cn(
          'w-1.5 shrink-0 cursor-ew-resize rounded transition-colors',
          'hover:bg-primary/30 active:bg-primary/50',
          resizing && 'bg-primary/40',
        )}
      />
      <div className="h-full min-h-0 min-w-0 flex-1">
        <AgentPanel workspaceRoot={workspaceRoot} className="w-full" />
      </div>
    </div>
  )
})
