/**
 * 记忆卡片（Anki）核心契约类型。
 */

export type FlashcardKind = 'basic' | 'cloze'

export interface Flashcard {
  id: string
  kind: FlashcardKind
  /** 问答卡正面（问题/考点），或填空卡正文（含 {{c1::...}}） */
  front: string
  /** 问答卡背面（答案/原文），或填空卡解析附加说明 */
  back: string
  /** Anki 标签列表，如 ['Inkdown', '书名', '章名'] */
  tags: string[]
  chapterName?: string
  sourceTitle: string
}
