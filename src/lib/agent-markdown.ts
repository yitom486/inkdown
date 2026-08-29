import DOMPurify, { type Config } from 'dompurify'
import { markdownParser } from '@/lib/markdown'
import { mermaidLog, summarizeMermaidSource } from '@/lib/mermaid-debug'

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

/** Agent 气泡完整 Markdown（含 mermaid fence → pre.mermaid） */
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

export type AgentMarkdownPart =
  | { type: 'html'; html: string }
  | { type: 'mermaid'; source: string; id: string }

function isMermaidElement(el: Element): boolean {
  const className = el.getAttribute('class') ?? ''
  return (
    className.split(/\s+/).includes('mermaid') ||
    className.split(/\s+/).includes('mermaid-hydrating')
  )
}

/**
 * 把消毒后的 Agent HTML 拆成「普通 HTML」与「Mermaid 源码」片段。
 * 必须递归：浏览器里 DOMPurify 常保留外层 `<div>`，Mermaid 会变成嵌套节点；
 * 只扫一层时 mermaidCount=0，整段 innerHTML 里只剩源码灰框（日志里只有 split 没有 block:effect）。
 */
export function splitAgentMarkdownParts(html: string): AgentMarkdownPart[] {
  if (!html.trim()) return []
  if (typeof DOMParser === 'undefined') {
    return [{ type: 'html', html }]
  }

  const doc = new DOMParser().parseFromString(
    `<div id="inkdown-md-split">${html}</div>`,
    'text/html',
  )
  const root = doc.getElementById('inkdown-md-split') ?? doc.body
  const parts: AgentMarkdownPart[] = []
  let htmlBuf = ''
  let mermaidSeq = 0

  const flushHtml = () => {
    if (!htmlBuf) return
    parts.push({ type: 'html', html: htmlBuf })
    htmlBuf = ''
  }

  const walk = (node: Node): void => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element
      if (isMermaidElement(el)) {
        flushHtml()
        const source = (
          el.getAttribute('data-mermaid-source') ||
          el.textContent ||
          ''
        ).trim()
        if (source) {
          parts.push({ type: 'mermaid', source, id: `agent-mmd-${++mermaidSeq}` })
        }
        return
      }

      // 含嵌套 mermaid：拆开子节点，避免 outerHTML 把图源码封进 html 段
      if (el.querySelector?.('.mermaid, .mermaid-hydrating')) {
        for (const child of Array.from(el.childNodes)) {
          walk(child)
        }
        return
      }

      htmlBuf += el.outerHTML
      return
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ''
      if (text) htmlBuf += text
    }
  }

  for (const child of Array.from(root.childNodes)) {
    walk(child)
  }

  flushHtml()
  const result = parts.length > 0 ? parts : [{ type: 'html' as const, html }]
  const mermaidParts = result.filter((p) => p.type === 'mermaid')
  // 把关键数字写进 stage，折叠 Object 时也能看到
  mermaidLog(`split:parts mmd=${mermaidParts.length}/${result.length}`, {
    nestedHtmlHadMermaid: /class=["'][^"']*\bmermaid\b/.test(html),
    mermaids: mermaidParts.map((p) =>
      p.type === 'mermaid' ? { id: p.id, ...summarizeMermaidSource(p.source) } : null,
    ),
  })
  return result
}
