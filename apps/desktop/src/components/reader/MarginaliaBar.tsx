import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bookmark,
  Plus,
  PanelRightClose,
  FoldVertical,
  UnfoldVertical,
} from 'lucide-react'
import type { ReadingMark, ReadingMarkCategory } from '@inkdown/contracts'
import { resolveCardMeta } from '@/lib/reader/marks/resolve-card-meta'
import { KnowledgeCardItem } from './KnowledgeCardItem'
import { BracketConnector } from './BracketConnector'
import { sortMarksByDocumentPosition } from '@/lib/reader/marks/mark-document-order'

export interface MarginaliaBarProps {
  marks: ReadingMark[]
  activeAnchor?: string
  onMarkClick: (mark: ReadingMark) => void
  onDeleteMark?: (id: string) => void
  onOpenDiagram?: (diagramId: string) => void
  onHoverAnchor?: (anchor: string | undefined) => void
  onToggleCardCollapse: (id: string) => void
  onToggleAllCollapse: (collapse: boolean) => void
  onGenerateAiCard?: () => void
  onCloseRail?: () => void
  onPolishCard?: (id: string) => void
  className?: string
  /** 章节归属解析（阅读器按目录提供）；缺省时卡片不显示出处、不做本章致灰 */
  chapterOfMark?: (mark: ReadingMark) => { key: string; label: string } | null
  /** 当前阅读章节键：命中卡片正常显示，其余致灰 */
  currentChapterKey?: string
  /** 目录键序：卡片按文档位置排序（纵序对齐正文，同滚联动的前提） */
  chapterOrder?: string[]
  /**
   * 正文阅读进度 0~1（书级分数）：轨按等比跟随滚动，与正文同进退。
   * 缺省时不同滚（保留手动滚动）。手动滚动 3 秒内暂停跟随，不打架。
   */
  readingFraction?: number
}

export const MarginaliaBar: React.FC<MarginaliaBarProps> = ({
  marks,
  activeAnchor,
  onMarkClick,
  onDeleteMark,
  onOpenDiagram,
  onHoverAnchor,
  onToggleCardCollapse,
  onToggleAllCollapse,
  onGenerateAiCard,
  onCloseRail,
  onPolishCard,
  chapterOfMark,
  currentChapterKey,
  chapterOrder,
  readingFraction,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'all' | ReadingMarkCategory>('all')
  const railRef = useRef<HTMLElement>(null)

  const resolveCategory = (m: ReadingMark): ReadingMarkCategory => {
    return resolveCardMeta(m).category
  }

  const concepts = marks.filter((m) => resolveCategory(m) === 'concept')
  const quotes = marks.filter((m) => resolveCategory(m) === 'quote')
  const methods = marks.filter((m) => resolveCategory(m) === 'method')
  const diagrams = marks.filter((m) => resolveCategory(m) === 'diagram')
  const questions = marks.filter((m) => resolveCategory(m) === 'question')

  const filteredMarks = marks.filter((m) => {
    if (activeTab === 'all') return true
    return resolveCategory(m) === activeTab
  })

  const allCollapsed = marks.length > 0 && marks.every((m) => m.collapsed)

  // 卡片按文档位置排序：纵序对齐正文（章序优先，同章保序，无归属沉底）
  const chapterKeyOf = useMemo(() => {
    const fn = chapterOfMark
    return (m: ReadingMark): string | null => {
      try {
        return fn?.(m)?.key ?? null
      } catch {
        return null
      }
    }
  }, [chapterOfMark])
  const positionedMarks = useMemo(
    () => sortMarksByDocumentPosition(filteredMarks, chapterOrder ?? [], chapterKeyOf),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredMarks, chapterOrder],
  )

  // 同滚联动：正文进度等比映射到轨滚动；手动滚动 3 秒内暂停跟随
  const lastManualScrollRef = useRef(0)
  const programmaticScrollRef = useRef(0)
  useEffect(() => {
    const el = railRef.current
    if (!el) return
    const onScroll = () => {
      if (Date.now() - programmaticScrollRef.current < 150) return
      lastManualScrollRef.current = Date.now()
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    if (readingFraction === undefined) return
    if (Date.now() - lastManualScrollRef.current < 3000) return
    const el = railRef.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    if (max <= 0) return
    const f = Math.min(1, Math.max(0, readingFraction))
    programmaticScrollRef.current = Date.now()
    el.scrollTop = f * max
  }, [readingFraction])

  return (
    <aside
      id="marginalia-notes-stream"
      ref={railRef}
      aria-label="页边知识卡片流"
      className={`w-80 shrink-0 space-y-3 pt-4 pb-20 select-none px-3 bg-background/50 backdrop-blur-sm transition-all duration-300 overflow-y-auto ${className}`}
    >
      {/* 头部：标题 + 计数 + 批处理控件 */}
      <div className="space-y-2.5 px-0.5">
        <div className="text-[11px] text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Bookmark className="w-3.5 h-3.5 text-primary" />
            <span>知识卡片</span>
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono">
              {marks.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* 全部折叠 / 展开 */}
            <button
              type="button"
              onClick={() => onToggleAllCollapse(!allCollapsed)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title={allCollapsed ? '展开全部卡片' : '折叠全部为单行'}
            >
              {allCollapsed ? (
                <UnfoldVertical className="w-3.5 h-3.5" />
              ) : (
                <FoldVertical className="w-3.5 h-3.5" />
              )}
            </button>

            {/* AI 智能制卡 */}
            {onGenerateAiCard && (
              <button
                type="button"
                onClick={onGenerateAiCard}
                className="p-1 rounded hover:bg-primary/10 text-primary transition-colors cursor-pointer flex items-center gap-0.5 text-[11px] font-medium"
                title="AI 智能制卡"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>制卡</span>
              </button>
            )}

            {/* 收起侧边卡轨 */}
            {onCloseRail && (
              <button
                type="button"
                onClick={onCloseRail}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer ml-0.5"
                title="收起卡片栏"
              >
                <PanelRightClose className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 分类筛选药丸 */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-2 py-0.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
              activeTab === 'all'
                ? 'bg-muted text-foreground font-semibold border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            全部 ({marks.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('concept')}
            className={`px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0 ${
              activeTab === 'concept'
                ? 'font-semibold border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            style={{
              backgroundColor: activeTab === 'concept' ? 'var(--card-concept-bg)' : undefined,
              color: activeTab === 'concept' ? 'var(--card-concept-text)' : undefined,
              borderColor: activeTab === 'concept' ? 'var(--card-concept-text)' : undefined,
            }}
          >
            概念 ({concepts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quote')}
            className={`px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0 ${
              activeTab === 'quote'
                ? 'font-semibold border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            style={{
              backgroundColor: activeTab === 'quote' ? 'var(--card-quote-bg)' : undefined,
              color: activeTab === 'quote' ? 'var(--card-quote-text)' : undefined,
              borderColor: activeTab === 'quote' ? 'var(--card-quote-text)' : undefined,
            }}
          >
            引用 ({quotes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('method')}
            className={`px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0 ${
              activeTab === 'method'
                ? 'font-semibold border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            style={{
              backgroundColor: activeTab === 'method' ? 'var(--card-method-bg)' : undefined,
              color: activeTab === 'method' ? 'var(--card-method-text)' : undefined,
              borderColor: activeTab === 'method' ? 'var(--card-method-text)' : undefined,
            }}
          >
            方法 ({methods.length})
          </button>
          {diagrams.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('diagram')}
              className={`px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0 ${
                activeTab === 'diagram'
                  ? 'font-semibold border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              style={{
                backgroundColor: activeTab === 'diagram' ? 'var(--card-diagram-bg)' : undefined,
                color: activeTab === 'diagram' ? 'var(--card-diagram-text)' : undefined,
                borderColor: activeTab === 'diagram' ? 'var(--card-diagram-text)' : undefined,
              }}
            >
              图谱 ({diagrams.length})
            </button>
          )}
          {questions.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('question')}
              className={`px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0 ${
                activeTab === 'question'
                  ? 'font-semibold border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              style={{
                backgroundColor: activeTab === 'question' ? 'var(--card-question-bg)' : undefined,
                color: activeTab === 'question' ? 'var(--card-question-text)' : undefined,
                borderColor: activeTab === 'question' ? 'var(--card-question-text)' : undefined,
              }}
            >
              思考 ({questions.length})
            </button>
          )}
        </div>
      </div>

      {/* 卡片流（已按文档位置排序，纵序对齐正文） */}
      <div className="space-y-2.5">
        {positionedMarks.map((mark) => {
          const isHighlighted =
            activeAnchor &&
            ((mark.excerpt && mark.excerpt.includes(activeAnchor)) ||
              activeAnchor.includes(mark.excerpt || ''))

          // 章节归属：卡片主人的目录位置；命中当前章正常显示，否则致灰
          let chapter: { key: string; label: string } | null = null
          try {
            chapter = chapterOfMark?.(mark) ?? null
          } catch {
            chapter = null
          }
          const inCurrentChapter =
            !currentChapterKey || !chapter || chapter.key === currentChapterKey

          return (
            <div
              key={mark.id}
              className={`flex items-start gap-1 transition-opacity ${inCurrentChapter ? '' : 'opacity-55'}`}
            >
              <BracketConnector
                isCollapsed={!!mark.collapsed}
                isActive={!!isHighlighted}
                className="mt-0.5 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <KnowledgeCardItem
                  mark={mark}
                  isActive={!!isHighlighted}
                  sourceLabel={chapter?.label}
                  onToggleCollapse={() => onToggleCardCollapse(mark.id)}
                  onPolish={onPolishCard ? () => onPolishCard(mark.id) : undefined}
                  onDelete={onDeleteMark ? () => onDeleteMark(mark.id) : undefined}
                  onOpenDiagram={onOpenDiagram}
                  onAnchorClick={() => onMarkClick(mark)}
                  onCardClick={() => onMarkClick(mark)}
                  onHover={(hovering) => onHoverAnchor?.(hovering ? mark.excerpt : undefined)}
                />
              </div>
            </div>
          )
        })}

        {filteredMarks.length === 0 && (
          <div className="py-12 text-center text-xs text-muted-foreground/70">
            暂无该分类的知识卡片
          </div>
        )}
      </div>
    </aside>
  )
}
