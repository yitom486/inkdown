import type {
  InkdownMcpToolContext,
  InkdownMcpToolDefinition,
  InkdownMcpToolResult,
} from './inkdown-mcp-tools'

/**
 * 目录专用工具表（只挂给目录副会话，主会话看不到这四个工具）。
 * 所有写入都进渲染进程内存草稿（toc-draft），人点保存才进真正的
 * ocr-toc-cache；工具本身不落盘、不改源文件。
 */

const FINGERPRINT_PROP = {
  fingerprint: {
    type: 'string',
    description: '目标书指纹（取自任务提示，照抄）',
  },
}

const TOC_ENTRY_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: '章节标题' },
    printedPage: { type: 'number', description: '印在纸上的页码' },
    level: { type: 'number', description: '章/部=1，节=2，小节=3' },
  },
  required: ['title', 'printedPage'],
  additionalProperties: false,
}

export const INKDOWN_TOC_MCP_TOOLS: InkdownMcpToolDefinition[] = [
  {
    name: 'toc_list_draft',
    description: '查看当前目录草稿（条目、指纹）。写入后调用来自查。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'toc_replace_all',
    description:
      '整单写入目录草稿（首选，一次写完整个目录，只需确认一次）。' +
      'level：章/部=1，节=2，小节=3；水印碎片会被自动丢弃并计数。' +
      '缺页码的节父项会自动跟随后继（限连续3个），缺页码的章行会被丢弃：' +
      '章页码必须明确给出，不要留空。',
    inputSchema: {
      type: 'object',
      properties: {
        ...FINGERPRINT_PROP,
        entries: {
          type: 'array',
          description: '完整目录条目',
          items: TOC_ENTRY_SCHEMA,
        },
      },
      required: ['fingerprint', 'entries'],
      additionalProperties: false,
    },
  },
  {
    name: 'toc_upsert_entry',
    description: '新增或按标题更新一条目录（小修补用，大改走 toc_replace_all）。',
    inputSchema: {
      type: 'object',
      properties: {
        ...FINGERPRINT_PROP,
        entry: TOC_ENTRY_SCHEMA,
      },
      required: ['fingerprint', 'entry'],
      additionalProperties: false,
    },
  },
  {
    name: 'toc_delete_entry',
    description: '按序号（从 0 起）或标题删一条目录。',
    inputSchema: {
      type: 'object',
      properties: {
        ...FINGERPRINT_PROP,
        index: { type: 'number', description: '草稿序号，与 title 二选一' },
        title: { type: 'string', description: '条目标题，与 index 二选一' },
      },
      additionalProperties: false,
    },
  },
]

function invalidFingerprint(): InkdownMcpToolResult {
  return {
    content: [{ type: 'text', text: '缺少 fingerprint（取自任务提示，照抄）' }],
    isError: true,
  }
}

function fingerprintOf(args?: Record<string, unknown>): string | null {
  const fingerprint = args?.fingerprint
  return typeof fingerprint === 'string' && fingerprint.trim() ? fingerprint.trim() : null
}

/**
 * 指纹尾部（审计关联用）：只取后 24 位（如 `…版.pdf|208761996`），
 * 完整路径（含目录）绝不进日志。MCP 上下文里没有 session/opId
 * （工具入参是给模型看的契约，不能加），跨端关联靠“指纹尾＋耗时＋
 * 控制台时间戳”窗口对齐渲染端的 prompt:start / draft:wait 行。
 */
function fingerprintTail(args?: Record<string, unknown>): string {
  const fingerprint = args?.fingerprint
  if (typeof fingerprint !== 'string' || !fingerprint) return '-'
  return fingerprint.length > 24 ? `…${fingerprint.slice(-24)}` : fingerprint
}

export async function callInkdownTocTool(
  name: string,
  context: InkdownMcpToolContext,
  args?: Record<string, unknown>,
): Promise<InkdownMcpToolResult> {
  // 审计：工具起止耗时（渲染端按 operationId 关联 prompt 超时与草稿落袋时序）
  const startedAt = Date.now()
  try {
    return await callInkdownTocToolInner(name, context, args)
  } finally {
    console.info(
      `[toc-mcp] tool=${name} fp=${fingerprintTail(args)} elapsedMs=${Date.now() - startedAt}`,
    )
  }
}

async function callInkdownTocToolInner(
  name: string,
  context: InkdownMcpToolContext,
  args?: Record<string, unknown>,
): Promise<InkdownMcpToolResult> {
  switch (name) {
    case 'toc_list_draft': {
      const text = await context.readSnapshot('toc-draft-read')
      return { content: [{ type: 'text', text }] }
    }
    case 'toc_replace_all':
    case 'toc_upsert_entry':
    case 'toc_delete_entry': {
      const fingerprint = fingerprintOf(args)
      if (!fingerprint) return invalidFingerprint()
      const op = name === 'toc_replace_all' ? 'replace' : name === 'toc_upsert_entry' ? 'upsert' : 'delete'
      const text = await context.readSnapshot('toc-draft-write', {
        op,
        fingerprint,
        entries: args?.entries,
        entry: args?.entry,
        ...(typeof args?.title === 'string' ? { title: args.title } : {}),
        ...(typeof args?.index === 'number' ? { index: args.index } : {}),
      })
      return { content: [{ type: 'text', text }] }
    }
    default:
      return {
        content: [{ type: 'text', text: `未知目录工具: ${name}` }],
        isError: true,
      }
  }
}
