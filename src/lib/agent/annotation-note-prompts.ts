/** 批注 AI 助手：意图 / 改写 chip 与发给 Agent 的隐含指令（用户只点 chip）。 */

export type AnnotationIntentId =
  | 'explain'
  | 'thesis'
  | 'challenge'
  | 'plain'
  | 'custom'

export type AnnotationRefineId =
  | 'retry'
  | 'shorter'
  | 'longer'
  | 'casual'
  | 'formal'

export interface AnnotationIntentChip {
  id: AnnotationIntentId
  label: string
}

export interface AnnotationRefineChip {
  id: AnnotationRefineId
  label: string
}

export const ANNOTATION_INTENT_CHIPS: AnnotationIntentChip[] = [
  { id: 'explain', label: '解释这段' },
  { id: 'thesis', label: '提炼观点' },
  { id: 'challenge', label: '质疑一下' },
  { id: 'plain', label: '白话改写' },
  { id: 'custom', label: '其他…' },
]

export const ANNOTATION_REFINE_CHIPS: AnnotationRefineChip[] = [
  { id: 'retry', label: '换一种' },
  { id: 'shorter', label: '更短' },
  { id: 'longer', label: '更长' },
  { id: 'casual', label: '更口语' },
  { id: 'formal', label: '更正式' },
]

const INTENT_INSTRUCTIONS: Record<Exclude<AnnotationIntentId, 'custom'>, string> = {
  explain: '用简洁中文解释选区含义，写成可直接当作阅读批注的短文（不要复述全文）。',
  thesis: '抽出核心主张或结论，写成 1–3 句批注。',
  challenge: '针对选区提出 1–2 个合理疑问或反例，语气克制，写成批注。',
  plain: '把选区改写成更好懂的说法，仍用批注口吻，不要写成全书摘要。',
}

const REFINE_INSTRUCTIONS: Record<AnnotationRefineId, string> = {
  retry: '换一种写法，保持同一意图，不要重复上一版措辞。',
  shorter: '把当前草稿改得更短，保留要点。',
  longer: '把当前草稿稍写长一点，补充必要说明，仍保持批注长度。',
  casual: '把当前草稿改得更口语、好读。',
  formal: '把当前草稿改得更正式、克制。',
}

const OUTPUT_RULES = [
  '你在帮用户撰写阅读批注草稿，不是聊天客服。',
  '只输出批注正文本身：不要标题、不要 markdown 围栏、不要「以下是批注」等前后缀。',
  '不要调用 inkdown_create_note；草稿由客户端展示给用户确认后再保存。',
  '若信息不足，仍基于给定选区尽力写一版短批注。',
].join('\n')

export function buildAnnotationIntentPrompt(options: {
  excerpt: string
  intent: AnnotationIntentId
  customText?: string
}): { displayText: string; promptText: string } {
  const excerpt = options.excerpt.trim()
  if (options.intent === 'custom') {
    const ask = options.customText?.trim() || '请根据选区写一条有用的批注'
    return {
      displayText: ask,
      promptText: [
        OUTPUT_RULES,
        '',
        `用户意图：${ask}`,
        '',
        '选区原文：',
        excerpt || '（无选区文本）',
      ].join('\n'),
    }
  }

  const chip = ANNOTATION_INTENT_CHIPS.find((item) => item.id === options.intent)
  const instruction = INTENT_INSTRUCTIONS[options.intent]
  return {
    displayText: chip?.label ?? options.intent,
    promptText: [
      OUTPUT_RULES,
      '',
      `任务：${instruction}`,
      '',
      '选区原文：',
      excerpt || '（无选区文本）',
    ].join('\n'),
  }
}

export function buildAnnotationRefinePrompt(options: {
  excerpt: string
  draft: string
  refine: AnnotationRefineId
  lastIntentLabel?: string
}): { displayText: string; promptText: string } {
  const chip = ANNOTATION_REFINE_CHIPS.find((item) => item.id === options.refine)
  return {
    displayText: chip?.label ?? options.refine,
    promptText: [
      OUTPUT_RULES,
      '',
      `任务：${REFINE_INSTRUCTIONS[options.refine]}`,
      options.lastIntentLabel ? `原先意图：${options.lastIntentLabel}` : '',
      '',
      '选区原文：',
      options.excerpt.trim() || '（无选区文本）',
      '',
      '当前草稿：',
      options.draft.trim() || '（空）',
    ]
      .filter(Boolean)
      .join('\n'),
  }
}

/** 从 Agent 回复中抽出可当作批注的纯文本。 */
export function extractAnnotationDraft(raw: string): string {
  let text = raw.trim()
  if (!text) return ''

  const fenced = text.match(/```(?:\w+)?\s*([\s\S]*?)```/)
  if (fenced?.[1]?.trim()) {
    text = fenced[1].trim()
  }

  text = text
    .replace(/^这里是(?:批注|草稿)[:：]\s*/i, '')
    .replace(/^批注(?:正文)?[:：]\s*/i, '')
    .replace(/^草稿[:：]\s*/i, '')
    .trim()

  return text
}
