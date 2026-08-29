import DOMPurify, { type Config } from 'dompurify'
import { markdownParser } from '@/lib/markdown'

/** 与预览同源消毒策略；保留 pre.mermaid / code-block class 供后续 hook 使用 */
const AGENT_SANITIZE_OPTIONS: Config = {
  ALLOWED_URI_REGEXP:
    /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  ADD_TAGS: ['input'],
  ADD_ATTR: ['type', 'checked', 'disabled', 'class', 'id', 'aria-hidden', 'aria-label', 'title'],
}

/**
 * 包一层再消毒：sole-root 的 `<pre>` / `<div class="mermaid">` 在 DOMPurify+happy-dom
 * （及部分浏览器 fragment 路径）会被剥掉，导致纯 Mermaid 消息丢图。
 */
function sanitizeAgentHtml(html: string): string {
  return String(DOMPurify.sanitize(`<div>${html}</div>`, AGENT_SANITIZE_OPTIONS))
}

/** Agent 气泡完整 Markdown（含 mermaid fence → pre.mermaid，由 hook 再渲染） */
export function renderAgentMarkdown(text: string): string {
  if (!text.trim()) return ''
  return sanitizeAgentHtml(markdownParser.render(text))
}

/**
 * 流式中的轻量渲染：仍走 markdown-it；未闭合 fence 先补全，减少吞内容。
 */
export function renderAgentMarkdownStreaming(text: string): string {
  if (!text.trim()) return ''
  const fenceCount = (text.match(/^```/gm) ?? []).length
  const patched = fenceCount % 2 === 1 ? `${text}\n\`\`\`` : text
  return sanitizeAgentHtml(markdownParser.render(patched))
}
