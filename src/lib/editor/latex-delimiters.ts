const FENCE_PATTERN = /(```[\s\S]*?```)/g

/** LaTeX 块级/行内定界符 → markdown-it-katex 识别的 $ / $$ */
function normalizeLatexDelimitersInText(text: string): string {
  let result = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, body: string) => `$$${body}$$`)
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, body: string) => `$${body}$`)
  // 模型偶发省略反斜杠：单独一行的 [ / ] 包裹含 LaTeX 命令的内容
  result = result.replace(
    /^\[\s*\r?\n([\s\S]*?)\r?\n\]\s*$/gm,
    (match, body: string) => (/\\[a-zA-Z]/.test(body) ? `$$${body}$$` : match),
  )
  return result
}

/** 跳过 fenced code，将其余段落中的 LaTeX 定界符规范为 $ / $$ */
export function normalizeLatexDelimiters(source: string): string {
  const parts = source.split(FENCE_PATTERN)
  return parts
    .map((part) => (part.startsWith('```') ? part : normalizeLatexDelimitersInText(part)))
    .join('')
}
