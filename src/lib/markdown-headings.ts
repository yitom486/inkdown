export interface MarkdownHeading {
  level: number
  text: string
  /** 0-based line index in source */
  line: number
  id: string
}

export function stripMarkdownInline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|\*|_|`)/g, '')
    .trim()
}

export function slugifyHeading(text: string): string {
  const stripped = stripMarkdownInline(text)
  const slug = stripped
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return slug || 'heading'
}

export function assignHeadingIds(texts: string[]): string[] {
  const counts = new Map<string, number>()

  return texts.map((text) => {
    const base = slugifyHeading(text)
    const count = counts.get(base) ?? 0
    counts.set(base, count + 1)
    return count === 0 ? base : `${base}-${count}`
  })
}

export function parseMarkdownHeadings(content: string): MarkdownHeading[] {
  const lines = content.split('\n')
  const raw: { level: number; text: string; line: number }[] = []

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i]?.match(/^(#{1,6})\s+(.+)$/)
    if (!match) continue

    raw.push({
      level: match[1].length,
      text: match[2],
      line: i,
    })
  }

  const ids = assignHeadingIds(raw.map((item) => item.text))

  return raw.map((item, index) => ({
    level: item.level,
    text: stripMarkdownInline(item.text),
    line: item.line,
    id: ids[index]!,
  }))
}

/** 根据编辑器当前可见行，找到应对齐的标题 */
export function findActiveHeading(
  headings: MarkdownHeading[],
  visibleLine: number,
): MarkdownHeading | undefined {
  let active: MarkdownHeading | undefined

  for (const heading of headings) {
    if (heading.line <= visibleLine) {
      active = heading
    } else {
      break
    }
  }

  return active
}

export function scrollRatio(element: HTMLElement): number {
  const max = element.scrollHeight - element.clientHeight
  if (max <= 0) return 0
  return element.scrollTop / max
}

export function applyScrollRatio(element: HTMLElement, ratio: number): void {
  const max = element.scrollHeight - element.clientHeight
  element.scrollTop = Math.max(0, Math.min(max, ratio * max))
}
