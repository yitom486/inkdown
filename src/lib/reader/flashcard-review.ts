import type { Flashcard } from '@shared/types/flashcard'

export type FlashcardReviewRating = 'again' | 'hard' | 'good'

export interface FlashcardReviewStats {
  total: number
  reviewed: number
  counts: {
    again: number
    hard: number
    good: number
  }
}

export interface ClozeParsedResult {
  /** 正面呈现的挖空文本（包含交互遮罩） */
  frontText: string
  /** 挖空提取出的答案数组 */
  answers: string[]
  /** 背面呈现的高亮完整文本 */
  backHtml: string
  /** 是否整段全被挖空（无上下文语境） */
  isEntirelyMasked: boolean
  /** 记忆引导线索（前缀诱饵） */
  clue?: string
}

/**
 * 解析 Anki Cloze 语法（{{c1::答案}}），生成正面遮罩与背面高亮
 */
export function parseClozeContent(text: string): ClozeParsedResult {
  const clozeRegex = /\{\{c\d+::([\s\S]*?)\}\}/g
  const answers: string[] = []

  // 1. 提取所有答案
  let match: RegExpExecArray | null
  while ((match = clozeRegex.exec(text)) !== null) {
    if (match[1]) {
      answers.push(match[1].trim())
    }
  }

  // 2. 正面遮罩化
  const frontText = text.replace(
    /\{\{c\d+::([\s\S]*?)\}\}/g,
    ' [ ❓ 点击翻转查看答案 ] ',
  )

  // 检查是否全文整段皆被 {{c1::...}} 包裹，没有任何前后上下文
  const strippedText = frontText.replace(/\[\s*❓\s*点击翻转查看答案\s*\]/g, '').trim()
  const isEntirelyMasked = strippedText.length === 0 && answers.length > 0

  let clue: string | undefined
  if (isEntirelyMasked && answers[0]) {
    const firstAnswer = answers[0]
    clue = firstAnswer.length > 40 ? `${firstAnswer.slice(0, 38)}……` : firstAnswer
  }

  // 3. 背面高亮化
  const backHtml = text.replace(
    /\{\{c\d+::([\s\S]*?)\}\}/g,
    '<mark class="bg-primary/20 text-primary font-semibold px-1.5 py-0.5 rounded border border-primary/30">$1</mark>',
  )

  return {
    frontText,
    answers,
    backHtml,
    isEntirelyMasked,
    clue,
  }
}

/**
 * 计算复习统计数据
 */
export function calculateReviewStats(
  ratings: Record<string, FlashcardReviewRating>,
  total: number,
): FlashcardReviewStats {
  const counts = {
    again: 0,
    hard: 0,
    good: 0,
  }

  for (const rating of Object.values(ratings)) {
    if (rating === 'again') counts.again++
    else if (rating === 'hard') counts.hard++
    else if (rating === 'good') counts.good++
  }

  const reviewed = Object.keys(ratings).length

  return {
    total,
    reviewed,
    counts,
  }
}
