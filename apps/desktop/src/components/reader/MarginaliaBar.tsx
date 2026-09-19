import React, { useState } from 'react'
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
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'all' | ReadingMarkCategory>('all')

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

  return (
    <aside
      id="marginalia-notes-stream"
      aria-label="页边知识卡片流"
      className={`w-80 shrink-0 space-y-3 pt-4 pb-20 select-none px-3 border-l border-border/60 bg-background/50 backdrop-blur-sm transition-all duration-300 overflow-y-auto ${className}`}
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

      {/* 卡片流 */}
      <div className="space-y-2.5">
        {filteredMarks.map((mark) => {
          const isHighlighted =
            activeAnchor &&
            ((mark.excerpt && mark.excerpt.includes(activeAnchor)) ||
              activeAnchor.includes(mark.excerpt || ''))

          return (
            <KnowledgeCardItem
              key={mark.id}
              mark={mark}
              isActive={!!isHighlighted}
              onToggleCollapse={() => onToggleCardCollapse(mark.id)}
              onPolish={onPolishCard ? () => onPolishCard(mark.id) : undefined}
              onDelete={onDeleteMark ? () => onDeleteMark(mark.id) : undefined}
              onOpenDiagram={onOpenDiagram}
              onAnchorClick={() => onMarkClick(mark)}
              onCardClick={() => onMarkClick(mark)}
              onHover={(hovering) => onHoverAnchor?.(hovering ? mark.excerpt : undefined)}
            />
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
