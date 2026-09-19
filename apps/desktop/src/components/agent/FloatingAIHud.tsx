import { memo, useEffect, useRef, useState } from 'react'
import {
  Bookmark,
  ChevronUp,
  Columns2,
  FileText,
  ListTree,
  MessageSquare,
  Minimize2,
  Sparkles,
  X,
} from 'lucide-react'
import { AgentPanel } from '@/components/agent/AgentPanel'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAcpUiStore } from '@/stores/acp-ui-store'
import { useReaderHudUiStore, type HudActiveTab } from '@/stores/acp/reader-hud-store'
import { BUILTIN_ACP_RUNTIMES } from '@inkdown/contracts'

interface FloatingAIHudProps {
  workspaceRoot?: string
}

export const FloatingAIHud = memo(function FloatingAIHud({
  workspaceRoot,
}: FloatingAIHudProps) {
  const panelOpen = useAcpUiStore((s) => s.panelOpen)
  const hudDisplayMode = useAcpUiStore((s) => s.hudDisplayMode)
  const setHudDisplayMode = useAcpUiStore((s) => s.setHudDisplayMode)
  const setPanelOpen = useAcpUiStore((s) => s.setPanelOpen)
  const status = useAcpUiStore((s) => s.status)
  const selectedRuntimeId = useAcpUiStore((s) => s.selectedRuntimeId)

  // HUD Tab 与拖拽状态
  const hudActiveTab = useReaderHudUiStore((s) => s.hudActiveTab)
  const setHudActiveTab = useReaderHudUiStore((s) => s.setHudActiveTab)
  const floatingPosition = useReaderHudUiStore((s) => s.floatingPosition)
  const setFloatingPosition = useReaderHudUiStore((s) => s.setFloatingPosition)

  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null)

  // 悬浮窗口拖拽监听
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, select, input, textarea, a, [role="button"]')) {
      return
    }
    e.preventDefault()
    setIsDragging(true)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: floatingPosition.x,
      posY: floatingPosition.y,
    }
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragRef.current) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      const newX = Math.max(16, Math.min(window.innerWidth - 460, dragRef.current.posX + dx))
      const newY = Math.max(16, Math.min(window.innerHeight - 200, dragRef.current.posY + dy))
      setFloatingPosition({ x: newX, y: newY })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragRef.current = null
      document.body.style.userSelect = ''
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove, { passive: true })
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
    }
  }, [isDragging, setFloatingPosition])

  // 如果处于停靠模式或面板完全关闭且不是胶囊态，则不渲染悬浮组件
  if (hudDisplayMode === 'docked' || (!panelOpen && hudDisplayMode !== 'capsule')) {
    return null
  }

  const runtimeName =
    BUILTIN_ACP_RUNTIMES.find((rt) => rt.id === selectedRuntimeId)?.name ??
    selectedRuntimeId

  const isConnected = status === 'connected'
  const isConnecting = status === 'connecting'

  // Capsule 胶囊模式：微缩于右下角的先锋伴读微晶胶囊
  if (hudDisplayMode === 'capsule') {
    return (
      <div
        className="fixed bottom-5 right-6 z-40 flex items-center gap-2 rounded-full border border-border/80 dark:border-white/10 bg-background/90 dark:bg-[#0c0c10]/95 py-1.5 pl-3.5 pr-1.5 shadow-xl backdrop-blur-xl transition-all hover:border-foreground/30 hover:shadow-2xl"
        data-testid="ai-hud-capsule"
      >
        {/* 呼吸状态微光点 */}
        <span className="relative flex size-2 shrink-0 items-center justify-center">
          {isConnected ? (
            <>
              <span className="absolute size-2.5 rounded-full bg-emerald-500/30 animate-ping" />
              <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            </>
          ) : isConnecting ? (
            <span className="size-2 animate-pulse rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
          ) : (
            <span className="size-1.5 rounded-full bg-muted-foreground/40" />
          )}
        </span>

        <button
          type="button"
          onClick={() => {
            setPanelOpen(true)
            setHudDisplayMode('floating')
          }}
          className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-foreground/90 transition-colors hover:text-foreground cursor-pointer"
          title="点击展开伴读 HUD"
        >
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">HUD</span>
          <span className="font-mono text-[10px] text-muted-foreground/50">·</span>
          <span className="max-w-[140px] truncate text-[11px] font-medium text-foreground">
            {runtimeName}
          </span>
        </button>

        <div className="flex items-center border-l border-border/60 pl-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50"
            title="停靠到侧栏"
            onClick={() => {
              setPanelOpen(true)
              setHudDisplayMode('docked')
            }}
          >
            <Columns2 className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50"
            title="展开浮窗"
            onClick={() => {
              setPanelOpen(true)
              setHudDisplayMode('floating')
            }}
          >
            <ChevronUp className="size-3" />
          </Button>
        </div>
      </div>
    )
  }

  const TABS: { id: HudActiveTab; label: string; icon: typeof MessageSquare }[] = [
    { id: 'chat', label: '对话', icon: MessageSquare },
    { id: 'cards', label: '卡片', icon: Bookmark },
    { id: 'summary', label: '摘要', icon: FileText },
    { id: 'outline', label: '大纲', icon: ListTree },
  ]

  // Floating 悬浮窗体模式：磨砂黑曜石与发丝微光浮岛质感（支持自由拖拽与 4 大 Tab）
  return (
    <div
      style={{ left: floatingPosition.x, top: floatingPosition.y }}
      onMouseDown={handleMouseDown}
      className={cn(
        'fixed z-40 flex flex-col',
        'w-[450px] max-w-[calc(100vw-2rem)] h-[660px] max-h-[calc(100vh-4rem)]',
        'overflow-hidden rounded-2xl border border-border/80 dark:border-white/10 bg-card/95 dark:bg-[#0c0c10]/95 shadow-2xl backdrop-blur-2xl ring-1 ring-black/5 dark:ring-white/5',
        isDragging ? 'cursor-grabbing shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)]' : 'transition-all duration-150',
      )}
      data-testid="floating-ai-hud"
    >
      {/* 顶部四大功能 Tab 栏 */}
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-3 py-1.5 select-none shrink-0">
        <div className="flex items-center gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = hudActiveTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setHudActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                  isActive
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
                )}
              >
                <Icon className="size-3.5" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-0.5 text-muted-foreground">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-lg hover:text-foreground"
            title="最小化为胶囊"
            onClick={() => setHudDisplayMode('capsule')}
          >
            <Minimize2 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-lg hover:text-foreground"
            title="停靠到侧栏"
            onClick={() => setHudDisplayMode('docked')}
          >
            <Columns2 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-lg hover:text-foreground"
            title="关闭面板"
            onClick={() => setPanelOpen(false)}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* 主展示区 */}
      <div className="flex-1 min-h-0 flex flex-col">
        {hudActiveTab === 'chat' && (
          <AgentPanel
            workspaceRoot={workspaceRoot}
            floating
            onToggleFloating={() => setHudDisplayMode('docked')}
            onMinimizeToCapsule={() => setHudDisplayMode('capsule')}
          />
        )}

        {hudActiveTab === 'cards' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Bookmark className="size-3.5 text-primary" />
                <span>本篇重点卡片</span>
              </span>
              <span className="text-[11px] text-muted-foreground">可右键或在侧栏统一导出</span>
            </div>
            <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
              <p>划选正文文字即可一键生成微晶知识卡片</p>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={() => setHudActiveTab('chat')}
              >
                <Sparkles className="size-3 text-primary" />
                向 AI 提问并生成要点
              </Button>
            </div>
          </div>
        )}

        {hudActiveTab === 'summary' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            <div className="space-y-1">
              <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                <span>智能研读纵深分析</span>
              </h4>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                全篇约束条目、架构规约与核心技术概念提取
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl border border-border/60 bg-muted/20 text-center space-y-1">
                <span className="text-[10px] text-muted-foreground block">强制规约 (MUST)</span>
                <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">12 条</span>
              </div>
              <div className="p-2.5 rounded-xl border border-border/60 bg-muted/20 text-center space-y-1">
                <span className="text-[10px] text-muted-foreground block">建议遵循 (SHOULD)</span>
                <span className="text-base font-bold font-mono text-blue-600 dark:text-blue-400">8 条</span>
              </div>
              <div className="p-2.5 rounded-xl border border-border/60 bg-muted/20 text-center space-y-1">
                <span className="text-[10px] text-muted-foreground block">预估通读</span>
                <span className="text-base font-bold font-mono text-foreground">15 分钟</span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-border/60 bg-card space-y-2">
              <span className="font-semibold text-[11px] text-foreground block">研读主旨</span>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                本文档规范了轻量客户端与服务端之间的时序握手协议，强调低延迟、强幂等与优雅降级。
              </p>
            </div>
          </div>
        )}

        {hudActiveTab === 'outline' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
            <div className="space-y-1 pb-2 border-b border-border/60">
              <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                <ListTree className="size-3.5 text-primary" />
                <span>智能导读与续读推荐</span>
              </h4>
              <p className="text-muted-foreground text-[11px]">
                根据当前阅读进度与知识图谱自动推荐的后续研读章节
              </p>
            </div>

            <div className="space-y-2">
              <div className="p-2.5 rounded-xl border border-border/60 bg-card hover:border-primary/50 transition-colors cursor-pointer space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">第 2 章 · 协议握手与时序</span>
                  <span className="text-[10px] font-mono text-primary font-semibold">相关度 95%</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  深度剖析 ClientHello 与 ServerHello 消息体的字段约束与双向心跳维护。
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-border/60 bg-card hover:border-primary/50 transition-colors cursor-pointer space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">第 4 章 · 异常处理与重试退避</span>
                  <span className="text-[10px] font-mono text-primary font-semibold">相关度 88%</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  涵盖指数退避加抖动（Full Jitter）策略与断网快速恢复通道。
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
