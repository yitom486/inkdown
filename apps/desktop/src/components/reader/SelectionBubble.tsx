import React, { useState } from 'react'
import {
  Check,
  Copy,
  FileText,
  HelpCircle,
  Highlighter,
  Layers,
  Scale,
  Sparkles,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type SelectionBubbleAction =
  | 'explain'
  | 'summary'
  | 'card'
  | 'compare'
  | 'question'

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'purple'

export interface SelectionBubbleProps {
  position: { x: number; y: number } | null
  selectedText: string
  onAskAgent?: (prompt: string) => void
  onGenerateCard?: (text: string) => void
  onHighlight?: (text: string, color: HighlightColor) => void
  onCopy?: () => void
  onClose: () => void
  className?: string
}

export function SelectionBubble({
  position,
  selectedText,
  onAskAgent,
  onGenerateCard,
  onHighlight,
  onCopy,
  onClose,
  className,
}: SelectionBubbleProps) {
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!position || !selectedText) return null

  const handleCopy = async () => {
    if (onCopy) {
      onCopy()
    } else {
      try {
        await navigator.clipboard.writeText(selectedText)
      } catch {
        // silent
      }
    }
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
      onClose()
    }, 1200)
  }

  const handleColorSelect = (color: HighlightColor) => {
    onHighlight?.(selectedText, color)
    setShowColorPicker(false)
    onClose()
  }

  const handleQuickAction = (actionType: SelectionBubbleAction) => {
    if (actionType === 'card') {
      onGenerateCard?.(selectedText)
    } else if (actionType === 'explain') {
      onAskAgent?.(`请深入解释并解构此段核心内涵：“${selectedText}”`)
    } else if (actionType === 'summary') {
      onAskAgent?.(`请提炼此段内容的精要摘要：“${selectedText}”`)
    } else if (actionType === 'compare') {
      onAskAgent?.(`请对比分析其他章节或文献中关于此观点的异同：“${selectedText}”`)
    } else {
      onAskAgent?.(`关于此段正文：“${selectedText}”，请进行深度解析：`)
    }
    onClose()
  }

  const colors: { id: HighlightColor; swatch: string; title: string }[] = [
    { id: 'yellow', swatch: '#FBE89B', title: '温润麦黄 (默认荧光)' },
    { id: 'green', swatch: '#D8EBD9', title: '苍苔浅绿' },
    { id: 'blue', swatch: '#D9E7F2', title: '霁青淡蓝' },
    { id: 'purple', swatch: '#EDDFF2', title: '烟紫浅藕' },
  ]

  return (
    <div
      id="selection-quick-bubble"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -135%)',
      }}
      className={cn(
        'fixed z-50 animate-in fade-in-0 zoom-in-95 duration-150 select-none',
        className,
      )}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* 核心气泡工具栏 */}
      <div className="flex items-center gap-0.5 rounded-2xl border border-border/80 bg-card/95 p-1 text-card-foreground shadow-2xl backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/10">
        {/* 1. 解释 */}
        <button
          type="button"
          onClick={() => handleQuickAction('explain')}
          className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted cursor-pointer"
          title="深入解释词句概念"
        >
          <span className="flex size-4 items-center justify-center rounded bg-primary/10 font-serif text-[11px] font-bold text-primary">
            A
          </span>
          <span>解释</span>
        </button>

        {/* 2. 摘要 */}
        <button
          type="button"
          onClick={() => handleQuickAction('summary')}
          className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted cursor-pointer"
          title="生成段落要旨摘要"
        >
          <FileText className="size-3.5 text-muted-foreground" />
          <span>摘要</span>
        </button>

        {/* 3. 生成卡片 */}
        <button
          type="button"
          onClick={() => handleQuickAction('card')}
          className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 cursor-pointer"
          title="抽取为知识卡片并存入页边"
        >
          <Layers className="size-3.5 text-primary" />
          <span>生成卡片</span>
        </button>

        {/* 4. 对比 */}
        <button
          type="button"
          onClick={() => handleQuickAction('compare')}
          className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted cursor-pointer"
          title="对比本篇与其他章节观点"
        >
          <Scale className="size-3.5 text-muted-foreground" />
          <span>对比</span>
        </button>

        {/* 5. 提问 */}
        <button
          type="button"
          onClick={() => handleQuickAction('question')}
          className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted cursor-pointer"
          title="基于此内容向 Agent 发起追问"
        >
          <HelpCircle className="size-3.5 text-muted-foreground" />
          <span>提问</span>
        </button>

        <div className="mx-0.5 h-4 w-px bg-border/80" />

        {/* 6. 荧光笔划重点 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            className={cn(
              'flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer',
              showColorPicker
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
            title="划线重点"
          >
            <span className="inline-block size-2.5 rounded-full border border-amber-400/60 bg-[#FBE89B]" />
            <Highlighter className="size-3.5 text-muted-foreground" />
          </button>

          {/* Color Picker Popover */}
          {showColorPicker && (
            <div className="absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border/80 bg-card/95 p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-90 duration-100">
              {colors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleColorSelect(c.id)}
                  title={c.title}
                  style={{ backgroundColor: c.swatch }}
                  className="size-5 rounded-full ring-1 ring-black/20 dark:ring-white/30 transition-transform hover:scale-125 cursor-pointer"
                />
              ))}
            </div>
          )}
        </div>

        {/* 7. 复制 */}
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
          title="复制所选文字"
        >
          {copied ? (
            <Check className="size-3.5 text-emerald-500" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>

        {/* 8. 关闭 */}
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
          title="关闭工具栏"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* 箭头指示 */}
      <div className="mx-auto -mt-1 size-2.5 rotate-45 border-r border-b border-border/80 bg-card/95 shadow-xs" />
    </div>
  )
}
