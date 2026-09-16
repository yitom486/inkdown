const FENCE_PATTERN = /(```[\s\S]*?```)/g
const INLINE_CODE_PATTERN = /(`+[^`]*`+)/g

/** 常见数学命令；避免把 Windows 路径等 `\U`、`\t` 误判为公式。 */
const INLINE_LATEX_HINT =
  /\\(?:sim|text|ldots|frac|begin|end|cdot|times|pm|mp|leq|geq|neq|approx|alpha|beta|gamma|delta|pi|sigma|sum|prod|int|sqrt|overline|underline|vec|mathbf|mathrm|left|right|quad|qquad|cdots|infty|partial|nabla|forall|exists|in|notin|subset|supset|cup|cap|rightarrow|leftarrow|Rightarrow|Leftarrow|leftrightarrow|Leftrightarrow|to|gets)(?![a-zA-Z])|\\[a-zA-Z]+\{/

function countUnescaped(pattern: RegExp, text: string): number {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)
  let count = 0
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0
    let escapes = 0
    for (let i = start - 1; i >= 0 && text[i] === '\\'; i -= 1) escapes += 1
    if (escapes % 2 === 0) count += 1
  }
  return count
}

function wrapBareInlineLatexInText(text: string): string {
  return text.replace(
    /\(([^()\n]*)\)/g,
    (match, body: string) => {
      if (!INLINE_LATEX_HINT.test(body)) return match
      return `$${body}$`
    },
  )
}

/** LaTeX 块级/行内定界符 → markdown-it-katex 识别的 $ / $$ */
function normalizeLatexDelimitersInText(text: string): string {
  let result = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, body: string) => `$$${body}$$`)
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, body: string) => `$${body}$`)
  // 模型偶发省略反斜杠：单独一行的 [ / ] 包裹含 LaTeX 命令的内容
  result = result.replace(
    /^\[\s*\r?\n([\s\S]*?)\r?\n\]\s*$/gm,
    (match, body: string) => (/\\[a-zA-Z]/.test(body) ? `$$${body}$$` : match),
  )
  result = wrapBareInlineLatexInText(result)
  return result
}

function normalizeLatexDelimitersInSegment(text: string): string {
  const parts = text.split(INLINE_CODE_PATTERN)
  return parts
    .map((part) => (part.startsWith('`') ? part : normalizeLatexDelimitersInText(part)))
    .join('')
}

/** 跳过 fenced code，将其余段落中的 LaTeX 定界符规范为 $ / $$ */
export function normalizeLatexDelimiters(source: string): string {
  const parts = source.split(FENCE_PATTERN)
  return parts
    .map((part) => (part.startsWith('```') ? part : normalizeLatexDelimitersInSegment(part)))
    .join('')
}

/**
 * 流式输出时临时闭合未完成的公式定界符，避免后续 Markdown 被吞或整段解析错乱。
 * 与 patchStreamingMarkdownFences 同一策略。
 */
export function patchStreamingMathDelimiters(text: string): string {
  if (!text.trim()) return text

  let result = text

  const blockDelims = countUnescaped(/\$\$/g, result)
  if (blockDelims % 2 === 1) {
    result += '\n$$'
  }

  const withoutBlocks = result.replace(/\$\$/g, '')
  const inlineDelims = countUnescaped(/\$/g, withoutBlocks)
  if (inlineDelims % 2 === 1) {
    result += '$'
  }

  if (countUnescaped(/\\\[/g, result) > countUnescaped(/\\\]/g, result)) {
    result += '\n\\]'
  }

  if (countUnescaped(/\\\(/g, result) > countUnescaped(/\\\)/g, result)) {
    result += '\\)'
  }

  return result
}
