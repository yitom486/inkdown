import MarkdownIt from 'markdown-it'
import markdownItKatexImport from '@vscode/markdown-it-katex'
import markdownItTaskLists from 'markdown-it-task-lists'
import { highlightCode } from '@/lib/editor/code-highlight'
import { wrapHighlightedCodeBlock } from '@/lib/editor/code-block-lines'
import { slugifyHeading } from '@/lib/editor/markdown-headings'

// CJS 包在 Vite ESM 下可能导出为 { default: fn }，需兼容处理
const markdownItKatex =
  typeof markdownItKatexImport === 'function'
    ? markdownItKatexImport
    : (markdownItKatexImport as { default: typeof markdownItKatexImport }).default

export const markdownParser = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})
  .use(markdownItKatex, { throwOnError: false })
  .use(markdownItTaskLists, { enabled: true, label: true, labelAfter: true })

const COPY_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`

markdownParser.renderer.rules.fence = (tokens, index, _options, _environment, _self) => {
  const token = tokens[index]
  const rawLang = token.info?.trim().split(/\s+/)[0]?.toLowerCase() ?? ''

  if (rawLang === 'mermaid') {
    return `<pre class="mermaid">${markdownParser.utils.escapeHtml(token.content)}</pre>`
  }

  const langLabel = rawLang || 'text'
  const highlighted = highlightCode(token.content, langLabel)
  const codeHtml = wrapHighlightedCodeBlock(token.content, highlighted, langLabel)

  return [
    '<div class="code-block">',
    '<div class="code-block-toolbar">',
    `<span class="code-block-lang">${markdownParser.utils.escapeHtml(langLabel)}</span>`,
    `<button type="button" class="code-block-copy" aria-label="复制代码" title="复制代码">${COPY_ICON_SVG}</button>`,
    '</div>',
    codeHtml,
    '</div>',
  ].join('')
}

markdownParser.renderer.rules.heading_open = (tokens, index, options, env, self) => {
  const token = tokens[index]
  const inlineToken = tokens[index + 1]
  const text = inlineToken?.content ?? ''

  const slugEnv = env ?? {}
  if (!slugEnv.headingSlugCounts || !(slugEnv.headingSlugCounts instanceof Map)) {
    slugEnv.headingSlugCounts = new Map<string, number>()
  }

  const counts = slugEnv.headingSlugCounts as Map<string, number>
  const base = slugifyHeading(text)
  const count = counts.get(base) ?? 0
  counts.set(base, count + 1)
  const id = count === 0 ? base : `${base}-${count}`

  token.attrSet('id', id)
  return self.renderToken(tokens, index, options)
}
