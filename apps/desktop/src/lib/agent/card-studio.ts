import type { ReadingMarkCategory } from '@inkdown/contracts'
import type { HeuristicCardResult } from '@/lib/reader/marks/heuristic-card-classifier'
import { highlightColorForCategory } from '@/lib/reader/marks/heuristic-card-classifier'
import {
  buildCardStudioPrompt,
  getCardStudioPreset,
} from '@/lib/agent/card-studio-presets'
import { sendCardStudioPrompt } from '@/lib/agent/card-studio-session'
import { extractJsonFromResponse } from '@/lib/quiz/quiz-evaluator'
import { heuristicClassifyMark } from '@/lib/reader/marks/heuristic-card-classifier'

/**
 * AI 制卡编排（P1）：预设 prompt → 本书会话调模型 → 校验成卡。
 * 返回 null 仅当入参非法（调用方 toast 报错）；
 * 模型无响应/结果非法一律回启发式 + `fallback: true`（调用方如实提示），
 * 形状恒为 `HeuristicCardResult`，下游 `saveHighlight` 零改。
 */

const CARD_CATEGORIES: readonly ReadingMarkCategory[] = [
  'concept',
  'quote',
  'method',
  'diagram',
  'question',
]

export interface AiCardInput {
  excerpt: string
  presetId: string
  customText?: string
  bookKey: string
}

export interface AiCardOutcome {
  card: HeuristicCardResult
  /** true=启发式兜底（离线/模型无响应/结果非法） */
  fallback: boolean
}

interface AiCardJson {
  title?: unknown
  category?: unknown
  aiSummary?: unknown
  keyPoints?: unknown
}

function toCleanString(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLen)
}

function toKeyPoints(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, 3)
}

export function parseAiCardJson(
  raw: string,
  presetCategory: ReadingMarkCategory | 'auto',
  excerpt: string,
): Omit<HeuristicCardResult, 'color'> | null {
  const parsed = extractJsonFromResponse<AiCardJson>(raw)
  if (!parsed) return null
  const title = toCleanString(parsed.title, 24)
  const aiSummary = toCleanString(parsed.aiSummary, 500)
  const keyPoints = toKeyPoints(parsed.keyPoints)
  if (!title || !aiSummary || keyPoints.length === 0) return null
  let category: ReadingMarkCategory
  if (presetCategory === 'auto') {
    if (typeof parsed.category !== 'string') return null
    const normalized = parsed.category.trim() as ReadingMarkCategory
    if (!CARD_CATEGORIES.includes(normalized)) return null
    category = normalized
  } else {
    category = presetCategory
  }
  return { title, category, aiSummary, keyPoints }
}

export async function generateAiCardContent(input: AiCardInput): Promise<AiCardOutcome | null> {
  const excerpt = input.excerpt.trim()
  if (!excerpt) return null
  const preset = getCardStudioPreset(input.presetId)
  if (!preset) return null

  const reply = await sendCardStudioPrompt(
    input.bookKey,
    buildCardStudioPrompt(excerpt, preset, input.customText),
  )
  if (reply) {
    const parsed = parseAiCardJson(reply, preset.category, excerpt)
    if (parsed) {
      return {
        card: { ...parsed, color: highlightColorForCategory(parsed.category) },
        fallback: false,
      }
    }
  }
  // 兜底：今日启发式（离线/无响应/结果非法统一路口）
  return { card: heuristicClassifyMark(excerpt), fallback: true }
}
