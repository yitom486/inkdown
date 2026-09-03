import MarkdownIt, { type StateInline, type Token } from 'markdown-it'

export type MarkdownItInstance = InstanceType<typeof MarkdownIt>

export interface WikilinkMeta {
  target: string
  label: string
}

export function parseWikilinkContent(content: string): WikilinkMeta {
  const parts = content.split('|')
  const target = parts[0]?.trim() ?? ''
  const label = parts[1]?.trim() || target
  return { target, label }
}

/**
 * markdown-it 双向链接插件（解析 [[target]] 与 [[target|label]]）
 */
export function markdownItWikilinks(md: MarkdownItInstance): void {
  md.inline.ruler.before('link', 'wikilink', (state: StateInline, silent: boolean): boolean => {
    const src = state.src
    const pos = state.pos

    // 检查起始 '[['
    if (src.charCodeAt(pos) !== 0x5b || src.charCodeAt(pos + 1) !== 0x5b) {
      return false
    }

    // 查找闭合 ']]'
    const endPos = src.indexOf(']]', pos + 2)
    if (endPos === -1) {
      return false
    }

    // 双链标签内禁止换行
    const rawContent = src.slice(pos + 2, endPos)
    if (rawContent.includes('\n')) {
      return false
    }

    if (!silent) {
      const { target, label } = parseWikilinkContent(rawContent)
      if (target) {
        const token = state.push('wikilink', '', 0)
        token.content = label
        token.meta = { target, label }
      }
    }

    state.pos = endPos + 2
    return true
  })

  md.renderer.rules.wikilink = (tokens: Token[], idx: number) => {
    const token = tokens[idx]
    if (!token) return ''
    const { target, label } = (token.meta as unknown as WikilinkMeta) || { target: '', label: '' }
    const escapedTarget = md.utils.escapeHtml(target)
    const escapedLabel = md.utils.escapeHtml(label)
    const isEbook = /\.(pdf|epub|mobi|azw3)(#|$)/i.test(target)
    const badgeClass = isEbook ? 'inkdown-wikilink-book' : 'inkdown-wikilink-note'

    return `<a class="inkdown-wikilink ${badgeClass}" data-wikilink-target="${escapedTarget}" href="#wikilink:${encodeURIComponent(
      target,
    )}" title="${escapedTarget}"><span class="inkdown-wikilink-icon">${isEbook ? '📖' : '📄'}</span>${escapedLabel}</a>`
  }
}
