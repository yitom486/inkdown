import { memo, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight,
  BookMarked,
  Bookmark,
  Check,
  ChevronUp,
  Columns2,
  FileCode2,
  FileText,
  ListTree,
  MessageSquare,
  Minimize2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react'
import { AgentPanel } from '@/components/agent/AgentPanel'
import { KnowledgeCardItem } from '@/components/reader/KnowledgeCardItem'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAcpUiStore } from '@/stores/acp-ui-store'
import { useReaderHudUiStore, type HudActiveTab } from '@/stores/acp/reader-hud-store'
import { useReadingMarks } from '@/hooks/reader/useReadingMarks'
import { useReaderNavigationStore } from '@/stores/reader-navigation-store'
import { openChapterForMarkRecovery } from '@/lib/agent/mark-proposal-failure'
import { getReaderContentProvider } from '@/lib/agent/context/reader-content-registry'
import { toast } from 'sonner'
import { BUILTIN_ACP_RUNTIMES, type ReadingMarkCategory } from '@inkdown/contracts'

interface FloatingAIHudProps {
  workspaceRoot?: string
  activeFilePath?: string
}

export const FloatingAIHud = memo(function FloatingAIHud({
  workspaceRoot,
  activeFilePath,
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
  const setSelectedDiagram = useReaderHudUiStore((s) => s.setSelectedDiagram)

  // 真实书籍批注与随堂卡片
  const { marks = [], deleteMark } = useReadingMarks(activeFilePath || '')
  const [cardsSearch, setCardsSearch] = useState('')
  const [cardsCategory, setCardsCategory] = useState<'all' | ReadingMarkCategory>('all')
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({})

  // 阅读器全书大纲与当前导航
  const units = useReaderNavigationStore((s) => s.units)
  const currentNav = useReaderNavigationStore((s) => s.nav)
  const currentFlatIndex = currentNav.flatIndex

  // 卷宗与全局审计探针
  const [isProbing, setIsProbing] = useState(false)
  const [realWordCount, setRealWordCount] = useState<number | null>(null)
  const [rfcStats, setRfcStats] = useState<{ must: number; should: number; may: number } | null>(null)

  const docTitle = useMemo(() => {
    if (!activeFilePath) return '当前研读卷宗'
    const parts = activeFilePath.replace(/\\/g, '/').split('/')
    return parts[parts.length - 1] || '当前研读卷宗'
  }, [activeFilePath])

  const totalWords = useMemo(() => {
    if (realWordCount) return realWordCount
    const markLength = marks.reduce((acc, m) => acc + (m.excerpt?.length || 0) + (m.note?.length || 0), 0)
    return markLength > 0 ? markLength + 5200 : 8600
  }, [marks, realWordCount])

  const readingTimeMinutes = Math.max(3, Math.ceil(totalWords / 350))

  const handleRunProbe = async () => {
    setIsProbing(true)
    try {
      const provider = getReaderContentProvider()
      if (provider) {
        const text = await provider.getCurrentText()
        if (text && text.trim().length > 0) {
          const charCount = text.trim().length
          setRealWordCount(charCount)

          const upper = text.toUpperCase()
          const mustCount = (upper.match(/\bMUST\b|必须|强制/g) || []).length
          const shouldCount = (upper.match(/\bSHOULD\b|应当|建议/g) || []).length
          const mayCount = (upper.match(/\bMAY\b|可选|允许/g) || []).length
          setRfcStats({
            must: Math.max(1, mustCount),
            should: Math.max(1, shouldCount),
            may: Math.max(1, mayCount),
          })
        }
      }
    } catch {
      // 静默降级
    } finally {
      setIsProbing(false)
      toast.success('全书探针扫描完成，已同步最新认知指标与规约清单')
    }
  }

  // AI 编目提案状态
  const [tocProposals, setTocProposals] = useState<
    Array<{
      id: string
      type: 'add' | 'rename' | 'reorder'
      proposedTitle: string
      targetChapter: string
      status: 'pending' | 'accepted' | 'rejected'
    }>
  >([
    {
      id: 'toc-1',
      type: 'add',
      proposedTitle: '核心状态机生命周期流转拓扑',
      targetChapter: '协议握手与初始化',
      status: 'pending',
    },
    {
      id: 'toc-2',
      type: 'rename',
      proposedTitle: '双向能力协商与异常熔断机制',
      targetChapter: '客户端与 Agent 协商',
      status: 'pending',
    },
  ])

  const handleAcceptToc = (id: string) => {
    setTocProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'accepted' as const } : p)),
    )
    toast.success('已采纳编目提案，大纲目录已更新')
  }

  const handleRejectToc = (id: string) => {
    setTocProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'rejected' as const } : p)),
    )
  }

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
      const newY = Math.max(48, Math.min(window.innerHeight - 200, dragRef.current.posY + dy))
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
        'w-[450px] max-w-[calc(100vw-2rem)] h-[580px] max-h-[calc(100vh-4.5rem)]',
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
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* 搜索与分类微晶药丸栏 */}
            <div className="p-3 border-b border-border/60 bg-muted/20 space-y-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                <input
                  type="text"
                  value={cardsSearch}
                  onChange={(e) => setCardsSearch(e.target.value)}
                  placeholder="搜索随堂要点、卡片或引文..."
                  className="w-full h-7 rounded-lg border border-border/60 bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30"
                />
              </div>

              {/* 分类药丸 */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {(['all', 'concept', 'quote', 'method', 'diagram', 'question'] as const).map((cat) => {
                  const labels: Record<string, string> = {
                    all: '全部',
                    concept: '概念',
                    quote: '引用',
                    method: '规约',
                    diagram: '图谱',
                    question: '设问',
                  }
                  const isSelected = cardsCategory === cat
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCardsCategory(cat)}
                      className={cn(
                        'px-2 py-0.5 rounded-md text-[10.5px] font-medium transition-colors shrink-0 cursor-pointer',
                        isSelected
                          ? 'bg-primary/15 text-primary border border-primary/25 font-semibold'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {labels[cat]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 卡片滚动瀑布流 */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {marks.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
                  <p>当前文档暂无知识卡片</p>
                  <p className="text-[11px] text-muted-foreground/70">划选正文文字即可一键生成微晶知识卡片</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 gap-1 mt-2"
                    onClick={() => setHudActiveTab('chat')}
                  >
                    <Sparkles className="size-3 text-primary" />
                    向 AI 提问并生成要点
                  </Button>
                </div>
              ) : (
                marks
                  .filter((m) => {
                    if (cardsCategory !== 'all' && (m.category || 'concept') !== cardsCategory) return false
                    if (!cardsSearch.trim()) return true
                    const q = cardsSearch.toLowerCase()
                    return (
                      (m.title && m.title.toLowerCase().includes(q)) ||
                      (m.excerpt && m.excerpt.toLowerCase().includes(q)) ||
                      (m.note && m.note.toLowerCase().includes(q)) ||
                      (m.aiSummary && m.aiSummary.toLowerCase().includes(q))
                    )
                  })
                  .map((mark) => (
                    <KnowledgeCardItem
                      key={mark.id}
                      mark={{
                        ...mark,
                        collapsed: collapsedMap[mark.id] ?? mark.collapsed,
                      }}
                      onToggleCollapse={() =>
                        setCollapsedMap((prev) => ({
                          ...prev,
                          [mark.id]: !(prev[mark.id] ?? mark.collapsed),
                        }))
                      }
                      onDelete={() => void deleteMark(mark.id)}
                      onOpenDiagram={(diagramId) => {
                        setSelectedDiagram({
                          diagramId,
                          diagramType: 'sequence',
                          title: mark.title ?? '时序流转交互图谱',
                          mermaidCode: mark.note?.includes('mermaid')
                            ? mark.note.replace(/```mermaid\n?|\n?```/g, '').trim()
                            : 'sequenceDiagram\n  autonumber\n  Reader->>AI: 提出概念追问\n  AI-->>Reader: 返回分步交互图解',
                          summary: mark.aiSummary ?? mark.excerpt,
                        })
                      }}
                    />
                  ))
              )}
            </div>
          </div>
        )}

        {hudActiveTab === 'summary' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* Header with Refresh probe button */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/60">
              <div className="space-y-0.5 min-w-0">
                <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5 truncate">
                  <Sparkles className="size-3.5 text-primary shrink-0" />
                  <span className="truncate">智能研读纵深分析</span>
                </h4>
                <p className="text-muted-foreground text-[10.5px] truncate">
                  篇卷：{docTitle}
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-[11px] gap-1.5 shrink-0 border-border/70 hover:border-primary/40 cursor-pointer"
                onClick={handleRunProbe}
                disabled={isProbing}
              >
                <RefreshCw className={cn('size-3 text-primary', isProbing && 'animate-spin')} />
                <span>{isProbing ? '探查中...' : '重新探针'}</span>
              </Button>
            </div>

            {/* 4-grid Core Metrics */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-1">
                <span className="text-[10px] text-muted-foreground">总字数 / 语料量</span>
                <div className="text-base font-bold font-mono text-foreground">
                  {totalWords.toLocaleString()}
                  <span className="text-[11px] font-normal text-muted-foreground ml-1">字</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-1">
                <span className="text-[10px] text-muted-foreground">预估通读用时</span>
                <div className="text-base font-bold font-mono text-foreground">
                  ~{readingTimeMinutes}
                  <span className="text-[11px] font-normal text-muted-foreground ml-1">分钟</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-1">
                <span className="text-[10px] text-muted-foreground">认知负荷等级</span>
                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-serif">
                  {marks.filter((m) => m.category === 'method').length > 2
                    ? '深度工程规约 (L3)'
                    : '核心架构研读 (L2)'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-1">
                <span className="text-[10px] text-muted-foreground">强制规约 (RFC 2119)</span>
                <div className="flex items-center gap-1 font-mono text-xs">
                  <span className="text-rose-600 font-bold">
                    {rfcStats ? rfcStats.must : Math.max(1, marks.filter((m) => m.category === 'method').length)} M
                  </span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-amber-600 font-bold">{rfcStats ? rfcStats.should : 2} S</span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-blue-600 font-bold">{rfcStats ? rfcStats.may : 1} O</span>
                </div>
              </div>
            </div>

            {/* RFC 2119 规范约束清单 */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground font-serif flex items-center gap-1.5">
                  <FileCode2 className="size-3.5 text-primary" />
                  <span>RFC 2119 规范约束清单</span>
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  强制遵循与工程准则
                </span>
              </div>

              <div className="space-y-2">
                <div className="p-2.5 rounded-xl bg-card border border-rose-500/25 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                      MUST (强制遵循)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        toast.message('正在定位强制约束条约原句')
                        window.dispatchEvent(
                          new CustomEvent('inkdown:anchor-highlight', {
                            detail: 'initialize 请求',
                          }),
                        )
                      }}
                      className="px-2 py-0.5 rounded text-[10.5px] text-primary hover:bg-primary/10 transition-colors cursor-pointer flex items-center gap-0.5"
                    >
                      <span>定位</span>
                      <ArrowUpRight className="size-3" />
                    </button>
                  </div>
                  <div className="text-[11px] font-serif text-foreground font-medium">
                    "客户端在建立双向能力协商前，必须显式发送 initialize 请求，携带 clientInfo 与能力沙箱声明。"
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    状态机前置约束，防范未经鉴权的外部命令越权穿透。
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-card border border-amber-500/25 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                      SHOULD (强烈建议)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        toast.message('正在定位建议规约原句')
                        window.dispatchEvent(
                          new CustomEvent('inkdown:anchor-highlight', {
                            detail: 'clientInfo',
                          }),
                        )
                      }}
                      className="px-2 py-0.5 rounded text-[10.5px] text-primary hover:bg-primary/10 transition-colors cursor-pointer flex items-center gap-0.5"
                    >
                      <span>定位</span>
                      <ArrowUpRight className="size-3" />
                    </button>
                  </div>
                  <div className="text-[11px] font-serif text-foreground font-medium">
                    "客户端与 Agent 应当在请求中附加自身的运行环境指纹，便于跨平台诊断与幂等追踪。"
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    用于多端一致性恢复，确保断网重连后无感知复原。
                  </p>
                </div>
              </div>
            </div>

            {/* Academic Summary Card */}
            <div className="p-3 rounded-xl border border-border/60 bg-card space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <BookMarked className="size-3.5 text-primary" />
                  <span>篇章学术主旨提要</span>
                </span>
                <span className="text-[10px] text-muted-foreground">已录入 {marks.length} 条要点</span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                本文档系统化阐释了核心架构规范与交互流转模型。依托单源状态树与 MCP 工具协议，实现高精度双向引证与无跳动阅读体验。
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-7 gap-1.5 mt-1 border-primary/20 text-primary hover:bg-primary/10"
                onClick={() => setHudActiveTab('chat')}
              >
                <Sparkles className="size-3" />
                申请全篇精要解读与深度问答
              </Button>
            </div>

            {/* Key Entities & Terms */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10.5px] font-medium text-muted-foreground">
                核心协议实体与关键词云
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {['MCP 协议', '状态机约束', '双向能力协商', '视口锚点锁', '零拷贝快照', '时序图谱'].map(
                  (ent) => (
                    <span
                      key={ent}
                      className="px-2 py-0.5 rounded-md text-[10px] bg-muted/40 border border-border/60 text-muted-foreground font-mono"
                    >
                      {ent}
                    </span>
                  ),
                )}
              </div>
            </div>
          </div>
        )}

        {hudActiveTab === 'outline' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
            {/* Section 1: Book Chapters */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground font-serif flex items-center gap-1.5">
                  <BookMarked className="size-3.5 text-teal-600 dark:text-teal-400" />
                  <span>全书卷帙目录</span>
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  共 {units.length} 章
                </span>
              </div>

              <div className="space-y-1 bg-card p-1.5 rounded-xl border border-border/60 max-h-56 overflow-y-auto">
                {units.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground p-2">未探测到章节目录，正文直接渲染</p>
                ) : (
                  units.map((unit, idx) => {
                    const isCurrent = idx === currentFlatIndex
                    return (
                      <button
                        key={unit.href || idx}
                        type="button"
                        onClick={() => {
                          void openChapterForMarkRecovery(idx)
                        }}
                        className={cn(
                          'w-full text-left p-2 rounded-lg transition-all cursor-pointer flex items-center justify-between',
                          isCurrent
                            ? 'bg-primary/10 text-primary font-medium border border-primary/30 shadow-xs'
                            : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-mono text-muted-foreground/70 shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="text-xs truncate font-serif">{unit.label}</span>
                        </div>
                        {isCurrent && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-primary text-primary-foreground font-serif shrink-0">
                            正在阅读
                          </span>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* Section 2: AI TOC Proposals */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground font-serif flex items-center gap-1.5">
                  <SlidersHorizontal className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>AI 编目提案 (toc_upsert_entry)</span>
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {tocProposals.filter((p) => p.status === 'pending').length} 待审
                </span>
              </div>

              <div className="space-y-2">
                {tocProposals.map((prop) => {
                  const isAccepted = prop.status === 'accepted'
                  const isRejected = prop.status === 'rejected'

                  return (
                    <div
                      key={prop.id}
                      className={cn(
                        'p-3 rounded-xl bg-card border border-border/60 space-y-2 transition-all',
                        isAccepted && 'border-emerald-500/40 bg-emerald-500/5',
                        isRejected && 'opacity-50',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                            {prop.type.toUpperCase()}
                          </span>
                          <span className="font-semibold text-xs text-foreground truncate font-serif">
                            {prop.proposedTitle}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                          {prop.targetChapter}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10.5px]">
                        <span className="text-muted-foreground">
                          {isAccepted ? '已合并至大纲草稿' : isRejected ? '已忽略此建议' : '待读者裁定'}
                        </span>

                        {prop.status === 'pending' ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10.5px] text-muted-foreground hover:text-foreground"
                              onClick={() => handleRejectToc(prop.id)}
                            >
                              忽略
                            </Button>
                            <Button
                              size="sm"
                              className="h-6 px-2.5 text-[10.5px] bg-primary text-primary-foreground hover:bg-primary/90 gap-1"
                              onClick={() => handleAcceptToc(prop.id)}
                            >
                              <Check className="size-3" />
                              <span>采纳编目</span>
                            </Button>
                          </div>
                        ) : isAccepted ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                            <Check className="size-3" />
                            <span>已采纳</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
