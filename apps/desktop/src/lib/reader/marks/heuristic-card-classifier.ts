import type { ReadingMarkCategory } from '@inkdown/contracts'
import type { HighlightColorId } from '@inkdown/reader-core'

export interface HeuristicCardResult {
  category: ReadingMarkCategory
  title: string
  aiSummary: string
  keyPoints: string[]
  color: HighlightColorId
}

/**
 * 启发式知识卡片分类与要点提炼引擎。
 * 根据划选文本的语义特征自动识别认知属性，并映射专属莫兰迪柔光色标。
 */
export function heuristicClassifyMark(text: string): HeuristicCardResult {
  const trimmed = text.trim()
  if (!trimmed) {
    return {
      category: 'concept',
      title: '核心要点',
      aiSummary: '随堂要点摘录',
      keyPoints: ['要点摘录'],
      color: 'blue',
    }
  }

  const upper = trimmed.toUpperCase()

  // 1. 规约法则 (method)：强约束性规范（RFC 2119 MUST/SHOULD 等）
  const hasMethodKeywords =
    upper.includes('MUST') ||
    upper.includes('SHOULD') ||
    upper.includes('SHALL') ||
    upper.includes('REQUIRED') ||
    trimmed.includes('必须') ||
    trimmed.includes('应当') ||
    trimmed.includes('规约') ||
    trimmed.includes('约束') ||
    trimmed.includes('强制')
  if (hasMethodKeywords) {
    return {
      category: 'method',
      title: extractSummaryTitle(trimmed, '规约约束法则'),
      aiSummary: `规范条目：${trimmed.slice(0, 100)}${trimmed.length > 100 ? '...' : ''}`,
      keyPoints: extractKeyPoints(trimmed),
      color: 'green',
    }
  }

  // 2. 时序与架构图谱 (diagram)
  const hasDiagramKeywords =
    trimmed.includes('时序') ||
    trimmed.includes('状态机') ||
    trimmed.includes('流程') ||
    trimmed.includes('拓扑') ||
    trimmed.includes('架构') ||
    upper.includes('FLOWCHART') ||
    upper.includes('SEQUENCE') ||
    upper.includes('PIPELINE')
  if (hasDiagramKeywords) {
    return {
      category: 'diagram',
      title: extractSummaryTitle(trimmed, '时序架构交互'),
      aiSummary: `流转演进：${trimmed.slice(0, 100)}${trimmed.length > 100 ? '...' : ''}`,
      keyPoints: extractKeyPoints(trimmed),
      color: 'pink',
    }
  }

  // 3. 文献引用 (quote)：引号或经典名言
  const hasQuoteMarks =
    (trimmed.startsWith('“') && trimmed.endsWith('”')) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('「') && trimmed.endsWith('」')) ||
    trimmed.includes('正如') ||
    trimmed.includes('著名') ||
    trimmed.includes('指出')
  if (hasQuoteMarks) {
    return {
      category: 'quote',
      title: extractSummaryTitle(trimmed, '经典引言'),
      aiSummary: `原典摘录：${trimmed.slice(0, 100)}${trimmed.length > 100 ? '...' : ''}`,
      keyPoints: extractKeyPoints(trimmed),
      color: 'yellow',
    }
  }

  // 4. 研读设问 (question)
  const hasQuestionKeywords =
    trimmed.includes('?') ||
    trimmed.includes('？') ||
    trimmed.includes('为什么') ||
    trimmed.includes('如何') ||
    trimmed.includes('难点') ||
    trimmed.includes('存疑')
  if (hasQuestionKeywords) {
    return {
      category: 'question',
      title: extractSummaryTitle(trimmed, '研读设问'),
      aiSummary: `待研判问题：${trimmed.slice(0, 100)}${trimmed.length > 100 ? '...' : ''}`,
      keyPoints: extractKeyPoints(trimmed),
      color: 'orange',
    }
  }

  // 5. 默认归为核心概念 (concept)
  return {
    category: 'concept',
    title: extractSummaryTitle(trimmed, '核心概念'),
    aiSummary: `概念要义：${trimmed.slice(0, 100)}${trimmed.length > 100 ? '...' : ''}`,
    keyPoints: extractKeyPoints(trimmed),
    color: 'blue',
  }
}

/** 提取首句作为卡片标题 */
function extractSummaryTitle(text: string, fallback: string): string {
  const firstSentence = text.split(/[。\n.!?！？]/)[0]?.trim()
  if (!firstSentence) return fallback
  if (firstSentence.length > 24) {
    return `${firstSentence.slice(0, 22)}...`
  }
  return firstSentence
}

/** 从文本中切分 1~3 条核心要点 */
function extractKeyPoints(text: string): string[] {
  const parts = text
    .split(/[；;。\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4)

  if (parts.length === 0) {
    return [text.slice(0, 40)]
  }
  return parts.slice(0, 3)
}
