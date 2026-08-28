import MarkdownIt from 'markdown-it'
import markdownItKatexImport from '@vscode/markdown-it-katex'

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
