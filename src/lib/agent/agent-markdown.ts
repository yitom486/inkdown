import DOMPurify, { type Config } from 'dompurify'
import { patchStreamingMathDelimiters } from '@/lib/editor/latex-delimiters'
import { renderMarkdown } from '@/lib/editor/markdown'

export type { AgentMarkdownPart, MarkdownPart } from '@/lib/editor/markdown-parts'
export { splitAgentMarkdownParts, splitMarkdownParts } from '@/lib/editor/markdown-parts'

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

/** 流式未闭合的 ``` fence 先补全，避免半截内容被吞或整段挤进异常节点 */
export function patchStreamingMarkdownFences(text: string): string {
  if (!text.trim()) return text
  const fenceCount = (text.match(/^```/gm) ?? []).length
  return fenceCount % 2 === 1 ? `${text}\n\`\`\`` : text
}

/**
 * Agent 气泡统一 Markdown 渲染（流式 / 完成共用同一套 markdown-it + 消毒）。
 * 流式仅额外补全未闭合 fence，避免结束后换渲染器导致整页重排。
 */
export function renderAgentMarkdown(
  text: string,
  options?: { streaming?: boolean },
): string {
  if (!text.trim()) return ''
  const patched = options?.streaming
    ? patchStreamingMathDelimiters(patchStreamingMarkdownFences(text))
    : text
  return sanitizeAgentHtml(renderMarkdown(patched))
}

/** @deprecated 使用 renderAgentMarkdown(text, { streaming: true }) */
export function renderAgentMarkdownStreaming(text: string): string {
  return renderAgentMarkdown(text, { streaming: true })
}
