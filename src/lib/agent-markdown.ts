import DOMPurify from 'dompurify'
import { markdownParser } from '@/lib/markdown'

/** Agent 聊天气泡用：复用项目 markdown-it + 消毒，不做 Mermaid 交互 */
export function renderAgentMarkdown(text: string): string {
  const html = markdownParser.render(text)
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel', 'class', 'id'],
  })
}
