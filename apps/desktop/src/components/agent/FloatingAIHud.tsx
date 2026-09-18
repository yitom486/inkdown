import { memo } from 'react'
import {
  Bot,
  ChevronUp,
  Columns2,
  Dock,
  Maximize2,
  Minimize2,
  Sparkles,
  X,
} from 'lucide-react'
import { AgentPanel } from '@/components/agent/AgentPanel'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAcpUiStore } from '@/stores/acp-ui-store'
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

  // Floating 悬浮窗体模式：磨砂黑曜石与发丝微光浮岛质感
  return (
    <div
      className={cn(
        'fixed bottom-5 right-6 z-40 flex flex-col',
        'w-[440px] max-w-[calc(100vw-3rem)] h-[640px] max-h-[calc(100vh-6rem)]',
        'overflow-hidden rounded-2xl border border-border/80 dark:border-white/10 bg-card/90 dark:bg-[#0c0c10]/95 shadow-2xl backdrop-blur-2xl ring-1 ring-black/5 dark:ring-white/5',
        'animate-in fade-in-0 zoom-in-95 duration-200',
      )}
      data-testid="floating-ai-hud"
    >
      <AgentPanel
        workspaceRoot={workspaceRoot}
        floating
        onToggleFloating={() => setHudDisplayMode('docked')}
        onMinimizeToCapsule={() => setHudDisplayMode('capsule')}
      />
    </div>
  )
})
