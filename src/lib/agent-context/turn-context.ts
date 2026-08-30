import type { DocumentKind } from '@shared/types/document'

/** 附加到用户消息前的 turn-context 体积上限（字符数） */
export const TURN_CONTEXT_MAX_CHARS = 1200

export interface InkdownActiveDocument {
  /** 绝对路径 */
  path: string
  kind: DocumentKind
  /** 文件名（含扩展名） */
  name: string
}

export interface InkdownReadingState {
  /** 阅读进度百分比，0–100 的整数 */
  percent?: number
  /** 当前所在章节 / 页 */
  current?: string
  previous?: string
  next?: string
  /** 目录单元总数（EPUB/MOBI 为章节数，PDF 为大纲项数） */
  unitCount?: number
}

export interface InkdownTurnContext {
  /** 相比上次附加的 turn-context，用户是否换了文件 */
  documentChanged: boolean
  activeDocument: InkdownActiveDocument | null
  reading?: InkdownReadingState
  /** 发送时用户是否选中了文本（不含选区正文，正文走 inkdown_get_selection） */
  hasSelection?: boolean
}

const OPEN_TAG = '<inkdown-turn-context>'
const CLOSE_TAG = '</inkdown-turn-context>'

/** 同一文件同一格式视为同一文档；无打开文件时为 null */
export function documentKey(doc: InkdownActiveDocument | null): string | null {
  if (!doc) return null
  return `${doc.kind}:${doc.path}`
}

function compactReading(reading: InkdownReadingState): InkdownReadingState | undefined {
  const entries = Object.entries(reading).filter(([, v]) => v !== undefined && v !== '')
  if (entries.length === 0) return undefined
  return Object.fromEntries(entries) as InkdownReadingState
}

/**
 * 序列化为附加在用户消息前的文本块。
 * 超出 {@link TURN_CONTEXT_MAX_CHARS} 时逐级丢弃可选字段，保证不会撑爆上下文。
 */
export function formatTurnContextBlock(
  context: InkdownTurnContext,
  maxChars = TURN_CONTEXT_MAX_CHARS,
): string {
  const reading = context.reading ? compactReading(context.reading) : undefined

  const candidates: InkdownTurnContext[] = [
    { ...context, reading },
    // 退化 1：只保留进度与当前位置
    {
      ...context,
      reading: reading
        ? compactReading({ percent: reading.percent, current: reading.current })
        : undefined,
    },
    // 退化 2：只剩文件本身
    { documentChanged: context.documentChanged, activeDocument: context.activeDocument },
  ]

  for (const candidate of candidates) {
    const text = `${OPEN_TAG}\n${JSON.stringify(candidate)}\n${CLOSE_TAG}`
    if (text.length <= maxChars) return text
  }

  const fallback: InkdownTurnContext = {
    documentChanged: context.documentChanged,
    activeDocument: context.activeDocument
      ? {
          path: context.activeDocument.path.slice(-160),
          kind: context.activeDocument.kind,
          name: context.activeDocument.name.slice(0, 80),
        }
      : null,
  }
  return `${OPEN_TAG}\n${JSON.stringify(fallback)}\n${CLOSE_TAG}`
}
