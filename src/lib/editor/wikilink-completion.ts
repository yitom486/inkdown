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
        const icon = isBook ? '📖 ' : '📄 '
        return {
          label: `${icon}${item.name}`,
          detail: item.path !== item.name ? item.path : undefined,
          apply: `[[${item.name}]]`,
          type: isBook ? 'variable' : 'text',
          boost: isBook ? 1 : 2,
        }
      })

    return {
      from: match.from,
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
