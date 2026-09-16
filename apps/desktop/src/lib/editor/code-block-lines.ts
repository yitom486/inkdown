/** 根据代码块原文生成行号列表（1-based） */
export function buildCodeBlockLineNumbers(content: string): string[] {
  if (content.length === 0) return ['1']

  const lines = content.split('\n')
  if (lines.at(-1) === '') {
    lines.pop()
  }

  return lines.map((_, index) => String(index + 1))
}

export function renderCodeBlockLineNumbers(content: string): string {
  return buildCodeBlockLineNumbers(content)
    .map((lineNumber) => `<span class="code-block-line-number">${lineNumber}</span>`)
    .join('')
}

export function wrapHighlightedCodeBlock(content: string, highlighted: string, langLabel: string): string {
  const escapedLang = langLabel
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
  const lineNumbers = renderCodeBlockLineNumbers(content)

  return [
    '<div class="code-block-body">',
    `<div class="code-block-lines" aria-hidden="true">${lineNumbers}</div>`,
    '<pre class="hljs">',
    `<code class="language-${escapedLang}">`,
    highlighted,
    '</code></pre>',
    '</div>',
  ].join('')
}
