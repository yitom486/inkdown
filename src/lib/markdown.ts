import MarkdownIt from 'markdown-it'
import markdownItKatexImport from '@vscode/markdown-it-katex'
import { slugifyHeading } from '@/lib/markdown-headings'

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

const defaultFenceRenderer = markdownParser.renderer.rules.fence

markdownParser.renderer.rules.fence = (tokens, index, options, environment, self) => {
  const token = tokens[index]

  if (token.info?.trim().toLowerCase() === 'mermaid') {
    return `<pre class="mermaid">${markdownParser.utils.escapeHtml(token.content)}</pre>`
  }

  if (defaultFenceRenderer) {
    return defaultFenceRenderer(tokens, index, options, environment, self)
  }

  return self.renderToken(tokens, index, options)
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
