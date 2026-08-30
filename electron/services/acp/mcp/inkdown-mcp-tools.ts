import type { InkdownVirtualResource } from '@shared/agent/inkdown-virtual-fs'

export interface InkdownMcpToolContext {
  /** 复用 ACP 快照回路：向渲染进程要内存快照 */
  readSnapshot: (resource: InkdownVirtualResource) => Promise<string>
}

export interface InkdownMcpToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

const NO_ARGS_SCHEMA = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const

export const INKDOWN_MCP_TOOLS: InkdownMcpToolDefinition[] = [
  {
    name: 'inkdown_get_toc',
    description:
      '获取用户当前在 Inkdown 中打开的文档的完整目录。返回 JSON：entries[].index/level/label、' +
      'currentIndex（当前所在条目）、unitCount、document（路径与格式）。' +
      '目录来自 Inkdown 已解析好的内存数据，不需要你自己解析 EPUB/PDF。' +
      '用户问「有哪些章节」「第几章讲什么」「跳到某章」时应先调用本工具，不要凭书名猜测。',
    inputSchema: NO_ARGS_SCHEMA,
  },
  {
    name: 'inkdown_get_current_text',
    description:
      '获取用户当前正在阅读的这一章（PDF 为当前页、Markdown 为全文）的纯文本正文。' +
      '正文来自 Inkdown 已经渲染好的内容，不要自己去读或解析 EPUB/MOBI/PDF 文件。' +
      '用户问「这章讲了什么」「总结一下当前内容」「解释这段」时调用本工具。' +
      '过长时会自动截断并在末尾标注。',
    inputSchema: NO_ARGS_SCHEMA,
  },
]

export interface InkdownMcpToolResult {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

export async function callInkdownMcpTool(
  name: string,
  context: InkdownMcpToolContext,
): Promise<InkdownMcpToolResult> {
  switch (name) {
    case 'inkdown_get_toc': {
      const text = await context.readSnapshot('toc.json')
      return { content: [{ type: 'text', text }] }
    }
    case 'inkdown_get_current_text': {
      const text = await context.readSnapshot('chapter.txt')
      return { content: [{ type: 'text', text }] }
    }
    default:
      return {
        content: [{ type: 'text', text: `未知工具: ${name}` }],
        isError: true,
      }
  }
}
