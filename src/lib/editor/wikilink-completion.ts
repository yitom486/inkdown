import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
  type CompletionSource,
} from '@codemirror/autocomplete'
import type { Extension } from '@codemirror/state'

export interface WikilinkCandidate {
  name: string
  path: string
  kind: string
}

/**
 * 构造 CodeMirror 6 `[[` 双向链接补全数据源
 */
export function createWikilinkCompletionSource(
  getCandidates: () => WikilinkCandidate[],
): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    // 匹配光标前的 `[[` 及当前已键入的检索词（不跨行、不含 `]`）
    const match = context.matchBefore(/\[\[([^\]\n]*)$/)
    if (!match) {
      return null
    }

    // 替换起点：精确在 `[[` 之后（保留已有左括号）
    const from = match.from + 2

    // 替换终点：如果光标后紧随 closeBrackets 自动插入的 ']]' 或 ']'，一并将其吞并替换
    const afterCursor = context.state.sliceDoc(context.pos, context.pos + 2)
    const to = context.pos + (afterCursor === ']]' ? 2 : afterCursor.startsWith(']') ? 1 : 0)

    const query = match.text.slice(2).trim().toLowerCase()
    const candidates = getCandidates()

    const options: Completion[] = candidates
      .filter((item) => {
        if (!query) return true
        return (
          item.name.toLowerCase().includes(query) ||
          item.path.toLowerCase().includes(query)
        )
      })
      .map((item) => {
        const isBook = ['pdf', 'epub', 'mobi', 'azw3'].includes(item.kind)
        return {
          label: item.name,
          detail: item.path !== item.name ? item.path : undefined,
          apply: `${item.name}]]`,
          type: isBook ? 'book' : 'note',
          boost: isBook ? 1 : 2,
        }
      })

    return {
      from,
      to,
      options,
      filter: false,
    }
  }
}

/**
 * 创建包含双链补全的 CodeMirror 扩展
 */
export function wikilinkAutocomplete(
  getCandidates: () => WikilinkCandidate[],
): Extension {
  return autocompletion({
    override: [createWikilinkCompletionSource(getCandidates)],
    defaultKeymap: true,
  })
}
