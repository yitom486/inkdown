import DOMPurify from 'dompurify'
import { markdownParser } from '@/lib/markdown'

const PURIFY = {
  USE_PROFILES: { html: true } as const,
  ADD_ATTR: ['target', 'rel', 'class', 'id'],
}

/** Agent 气泡完整 Markdown（含 mermaid fence → pre.mermaid，由 hook 再渲染） */
export function renderAgentMarkdown(text: string): string {
  if (!text.trim()) return ''
  const html = markdownParser.render(text)
  return DOMPurify.sanitize(html, PURIFY)
}

/**
 * 流式中的轻量渲染：仍走 markdown-it，但跳过整段重渲染成本极高的场景时
 * 由 UI 侧选择 plain / markdown；此处提供「可中断 fence」友好的渲染。
 */
export function renderAgentMarkdownStreaming(text: string): string {
  if (!text.trim()) return ''
  // 未闭合的 ``` 补一行，减少 fence 吞掉后续内容
  const fenceCount = (text.match(/^```/gm) ?? []).length
  const patched = fenceCount % 2 === 1 ? `${text}\n\`\`\`` : text
  const html = markdownParser.render(patched)
  return DOMPurify.sanitize(html, PURIFY)
}
