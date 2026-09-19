import type { ReactNode } from 'react'
import {
  Bookmark,
  BookmarkPlus,
  Coffee,
  Columns2,
  FileText,
  List,
  Maximize2,
  Minimize2,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Sun,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useReaderNavTitles } from '@/stores/reader-navigation-store'
import { useReaderHudUiStore } from '@/stores/acp/reader-hud-store'
import { useAcpUiStore } from '@/stores/acp-ui-store'
import { useEditorUiStore } from '@/stores/editor-ui-store'
import { preserveScrollAnchor } from '@/lib/reader/scroll-anchor'
import { cn } from '@/lib/utils'

interface ReaderToolbarShellProps {
  ready?: boolean
  tocDisabled?: boolean
  marksHidden?: boolean
  onTocToggle: () => void
  onMarksToggle: () => void
  onAddBookmark: () => void
  addBookmarkDisabled?: boolean
  center?: ReactNode
  trailing?: ReactNode
}

export function ReaderToolbarShell({
  ready = true,
  tocDisabled = false,
  marksHidden = false,
  onTocToggle,
  onMarksToggle,
  onAddBookmark,
  addBookmarkDisabled = false,
  center,
  trailing,
}: ReaderToolbarShellProps) {
  const { currentTitle } = useReaderNavTitles()

  // 伴读 HUD 与先锋卡轨状态
  const isCardRailOpen = useReaderHudUiStore((s) => s.isCardRailOpen)
  const toggleCardRail = useReaderHudUiStore((s) => s.toggleCardRail)
  const setIsNotesDrawerOpen = useReaderHudUiStore((s) => s.setIsNotesDrawerOpen)
  const zenMode = useReaderHudUiStore((s) => s.zenMode)
  const toggleZenMode = useReaderHudUiStore((s) => s.toggleZenMode)

  const hudDisplayMode = useAcpUiStore((s) => s.hudDisplayMode)
  const setHudDisplayMode = useAcpUiStore((s) => s.setHudDisplayMode)
  const panelOpen = useAcpUiStore((s) => s.panelOpen)
  const setPanelOpen = useAcpUiStore((s) => s.setPanelOpen)
  const acpStatus = useAcpUiStore((s) => s.status)

  // 循环切换伴读 HUD 模态（侧栏 -> 悬浮 -> 胶囊 -> 侧栏）
  const handleCycleHudMode = () => {
    if (!panelOpen) {
      setPanelOpen(true)
      setHudDisplayMode('docked')
      return
    }
    if (hudDisplayMode === 'docked') {
      setHudDisplayMode('floating')
    } else if (hudDisplayMode === 'floating') {
      setHudDisplayMode('capsule')
    } else {
      setHudDisplayMode('docked')
    }
  }

  const isAcpConnected = acpStatus === 'connected'

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-background/85 px-3 py-1.5 backdrop-blur-md select-none transition-colors">
      {/* 左侧：导航与目录组 */}
      <div className="flex min-w-0 items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 rounded-lg px-2 text-xs hover:bg-muted/80"
          disabled={!ready || tocDisabled}
          onClick={onTocToggle}
          title="展开 / 收起目录"
        >
          <List className="size-3.5 text-muted-foreground" />
          <span>目录</span>
        </Button>

        {!marksHidden ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 rounded-lg px-2 text-xs hover:bg-muted/80"
              disabled={!ready}
              onClick={onMarksToggle}
              title="传统批注列表面板"
            >
              <Bookmark className="size-3.5 text-muted-foreground" />
              <span>批注簿</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 rounded-lg px-2 text-xs hover:bg-muted/80"
              disabled={!ready || addBookmarkDisabled}
              onClick={onAddBookmark}
              title="在当前阅读位置添加书签"
            >
              <BookmarkPlus className="size-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">加书签</span>
            </Button>
          </>
        ) : null}

        {currentTitle ? (
          <span
            className="ml-1.5 hidden max-w-[240px] truncate text-xs font-medium text-muted-foreground md:inline-block lg:max-w-[340px]"
            title={currentTitle}
          >
            {currentTitle}
          </span>
        ) : null}
      </div>

      {/* 中部自定义控件 */}
      {center ? (
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1">{center}</div>
      ) : null}

      {/* 右侧：阅读器原生控件 + 微晶控制药丸组 */}
      <div className="flex shrink-0 items-center gap-2">
        {trailing ? (
          <div className="flex items-center gap-1.5 border-r border-border/50 pr-2">
            {trailing}
          </div>
        ) : null}

        {/* 先锋微晶控制胶囊组 */}
        <div className="flex items-center gap-1">
          {/* 知识卡轨切换 */}
          <Button
            variant={isCardRailOpen ? 'secondary' : 'ghost'}
            size="sm"
            className={cn(
              'h-7 gap-1.5 rounded-lg px-2 text-xs transition-all duration-150',
              isCardRailOpen
                ? 'border border-primary/20 bg-primary/10 text-primary font-medium hover:bg-primary/15'
                : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
            )}
            onClick={() => preserveScrollAnchor(() => toggleCardRail())}
            title={isCardRailOpen ? '收起右侧知识卡轨' : '展开右侧知识卡轨'}
          >
            {isCardRailOpen ? (
              <PanelRightClose className="size-3.5" />
            ) : (
              <PanelRightOpen className="size-3.5" />
            )}
            <span>卡片流</span>
          </Button>

          {/* 全书札记中心 */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            onClick={() => setIsNotesDrawerOpen(true)}
            title="查看全书札记中心与闪卡"
          >
            <FileText className="size-3.5" />
            <span className="hidden sm:inline">札记箱</span>
          </Button>

          {/* AI 伴读模式切换胶囊 */}
          <button
            type="button"
            onClick={handleCycleHudMode}
            className={cn(
              'flex h-7 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-all duration-150 cursor-pointer select-none',
              panelOpen
                ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 shadow-xs'
                : 'border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
            title={`当前伴读：${
              !panelOpen
                ? '已收起（点击唤起）'
                : hudDisplayMode === 'docked'
                  ? '侧栏停靠（点击切为悬浮 HUD）'
                  : hudDisplayMode === 'floating'
                    ? '悬浮窗体（点击切为极简胶囊）'
                    : '极简胶囊（点击切为侧栏停靠）'
            }`}
          >
            <Sparkles className="size-3.5 text-primary" />
            <span className="hidden md:inline">
              {!panelOpen
                ? '唤起伴读'
                : hudDisplayMode === 'docked'
                  ? '侧栏伴读'
                  : hudDisplayMode === 'floating'
                    ? '悬浮 HUD'
                    : '胶囊伴读'}
            </span>
            {/* 伴读运行状态微型指示点 */}
            <span
              className={cn(
                'size-1.5 rounded-full',
                isAcpConnected ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-muted-foreground/40',
              )}
            />
          </button>

          {/* 沉浸禅模式 */}
          <Button
            variant={zenMode ? 'secondary' : 'ghost'}
            size="icon"
            className={cn(
              'size-7 rounded-lg transition-all',
              zenMode
                ? 'border border-primary/30 bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
            )}
            onClick={() => toggleZenMode()}
            title={zenMode ? '退出沉浸禅模式 (Esc)' : '开启沉浸禅模式 (Ctrl+Alt+Z)'}
          >
            {zenMode ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </Button>

          {/* 三态微晶主题切换胶囊 (纸质白 / 羊皮纸暖调 / 石墨暗晶) */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/60">
            <button
              type="button"
              onClick={() => useEditorUiStore.getState().setTheme('light')}
              className={cn(
                'p-1 rounded-md transition-all cursor-pointer',
                useEditorUiStore((s) => s.theme) === 'light'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              title="纸质明亮模式"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => useEditorUiStore.getState().setTheme('sepia')}
              className={cn(
                'p-1 rounded-md transition-all cursor-pointer',
                useEditorUiStore((s) => s.theme) === 'sepia'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              title="羊皮纸暖调模式"
            >
              <Coffee className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => useEditorUiStore.getState().setTheme('dark')}
              className={cn(
                'p-1 rounded-md transition-all cursor-pointer',
                useEditorUiStore((s) => s.theme) === 'dark'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              title="极夜深色模式"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

