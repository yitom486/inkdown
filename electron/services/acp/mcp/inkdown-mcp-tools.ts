import type {
  InkdownSnapshotArgs,
  InkdownSnapshotResource,
} from '@shared/agent/inkdown-snapshot'

export interface InkdownMcpToolContext {
  /** 复用 ACP 快照回路：向渲染进程要内存快照 */
  readSnapshot: (
    resource: InkdownSnapshotResource,
    args?: InkdownSnapshotArgs,
  ) => Promise<string>
}

export interface InkdownMcpToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

const READER_FORMATS =
  'EPUB/PDF/MOBI/AZW3 与在线文档（web URL，阅读模式抓取的正文）'

export type InkdownReadScope = 'toc' | 'viewport' | 'current' | 'chapter' | 'search'

export type InkdownMarkListFilter = 'all' | 'highlights' | 'bookmarks'

const READ_SCOPE_ENUM = ['toc', 'viewport', 'current', 'chapter', 'search'] as const

const MARK_LIST_FILTER_ENUM = ['all', 'highlights', 'bookmarks'] as const

export const INKDOWN_MCP_TOOLS: InkdownMcpToolDefinition[] = [
  {
    name: 'inkdown_read',
    description:
      `读取当前打开的 ${READER_FORMATS} 内容（不含用户选区；选区用 inkdown_get_selection）。` +
      'scope 含义：toc=目录结构；viewport=当前视口约一屏（优先于整章）；current=当前章/页全文；' +
      'chapter=指定 TOC 章/页（需 flatIndex 或 title，不跳转）；search=全书关键词检索（需 query）。' +
      '正文 escalation：viewport → current → chapter；结构用 toc；「哪里提到 X」用 search。',
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: READ_SCOPE_ENUM,
          description: '读取范围',
        },
        flatIndex: {
          type: 'number',
          description: 'scope=chapter 时：目录 flatIndex（与 toc.entries[].index 一致）',
        },
        title: {
          type: 'string',
          description: 'scope=chapter 时：章节标题（可与 flatIndex 二选一，支持包含匹配）',
        },
        query: {
          type: 'string',
          description: 'scope=search 时：检索关键词（取自原文用词）',
        },
      },
      required: ['scope'],
      additionalProperties: false,
    },
  },
  {
    name: 'inkdown_get_selection',
    description:
      '获取用户当前选中的文本（高频独立工具）。若选区较短（≤30 字），仅向前后各补约 30 字作为 excerpt。' +
      '仅当 turn-context 出现 hasSelection=true（本轮新划选）时几乎必调；无此标记时不要调。' +
      '用户划选即优先分析该段；选区通知只生效一轮；无选区时会报错。',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'inkdown_list_marks',
    description:
      '列出当前打开文档的阅读标记。filter=all（默认）=书签+高亮+批注；highlights=仅划重点（高亮与带摘录批注，含 passages）；' +
      'bookmarks=仅书签。用于 EPUB/PDF/MOBI/在线文档。',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          enum: MARK_LIST_FILTER_ENUM,
          description: 'all | highlights | bookmarks；默认 all',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'inkdown_suggest_chapters',
    description:
      '提交章级划重点建议供用户点选（不写 marks、不调 propose_mark）。' +
      '先 inkdown_read(scope=toc)；再提交 2～5 章，每章含 flatIndex、title、reason。' +
      '用户点选一章后，再 read(scope=chapter) + inkdown_propose_mark(marks)，单批≤10。',
    inputSchema: {
      type: 'object',
      properties: {
        chapters: {
          type: 'array',
          description: '建议划重点的章节（2～5 条为宜）',
          minItems: 1,
          maxItems: 5,
          items: {
            type: 'object',
            properties: {
              flatIndex: { type: 'number', description: '与 toc.entries[].index 一致' },
              title: { type: 'string', description: '章节标题' },
              reason: { type: 'string', description: '一句推荐理由' },
            },
            required: ['flatIndex', 'title', 'reason'],
            additionalProperties: false,
          },
        },
      },
      required: ['chapters'],
      additionalProperties: false,
    },
  },
  {
    name: 'inkdown_create_bookmark',
    description:
      '在当前阅读位置创建书签（不跳转）。用户明确要求「加个书签」时调用；仅 EPUB/PDF/MOBI。',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'inkdown_propose_mark',
    description:
      '唯一标记提议工具（高亮 / 批注 / 批量，不入库；用户「采用」后才写入）。' +
      '单条：excerpt（原句或口述关键词）+ 可选 note（空=仅高亮）+ 可选 kind=highlight|note|auto + 可选 flatIndex。' +
      '有 fresh 选区时也可只传 note（用当前选区定位）。' +
      '批量：marks 数组（每项同单条字段，单批≤10）。' +
      '客户端读正文并模糊匹配原句；建议先 inkdown_read(scope=viewport) 或 scope=chapter。',
    inputSchema: {
      type: 'object',
      properties: {
        excerpt: {
          type: 'string',
          description: '单条：要高亮/批注的原文或口述片段',
        },
        note: {
          type: 'string',
          description: '批注正文；省略或空字符串则仅高亮',
        },
        kind: {
          type: 'string',
          enum: ['highlight', 'note', 'auto'],
          description: 'highlight=仅高亮；note=批注；auto=由 note 是否为空推断（默认）',
        },
        flatIndex: {
          type: 'number',
          description: '可选：目录 flatIndex',
        },
        marks: {
          type: 'array',
          description: '批量提议（≤10）；与 excerpt 二选一，优先 marks',
          items: {
            type: 'object',
            properties: {
              excerpt: { type: 'string' },
              note: { type: 'string' },
              kind: { type: 'string', enum: ['highlight', 'note', 'auto'] },
              flatIndex: { type: 'number' },
            },
            required: ['excerpt'],
            additionalProperties: false,
          },
          maxItems: 10,
        },
      },
      additionalProperties: false,
    },
  },
]

export interface InkdownMcpToolResult {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

function parseReadScope(value: unknown): InkdownReadScope | null {
  if (typeof value !== 'string') return null
  return READ_SCOPE_ENUM.includes(value as InkdownReadScope)
    ? (value as InkdownReadScope)
    : null
}

function parseMarkListFilter(value: unknown): InkdownMarkListFilter {
  if (value === 'highlights' || value === 'bookmarks') return value
  return 'all'
}

async function callInkdownRead(
  context: InkdownMcpToolContext,
  scope: InkdownReadScope,
  args?: Record<string, unknown>,
): Promise<InkdownMcpToolResult> {
  switch (scope) {
    case 'toc': {
      const text = await context.readSnapshot('toc.json')
      return { content: [{ type: 'text', text }] }
    }
    case 'viewport': {
      const text = await context.readSnapshot('viewport.txt')
      return { content: [{ type: 'text', text }] }
    }
    case 'current': {
      const text = await context.readSnapshot('chapter.txt')
      return { content: [{ type: 'text', text }] }
    }
    case 'chapter': {
      const flatIndex = args?.flatIndex
      const title = args?.title
      if (
        (typeof flatIndex !== 'number' || !Number.isFinite(flatIndex)) &&
        (typeof title !== 'string' || !title.trim())
      ) {
        return {
          content: [
            {
              type: 'text',
              text: 'inkdown_read(scope=chapter) 需要 flatIndex 或 title 之一',
            },
          ],
          isError: true,
        }
      }
      const text = await context.readSnapshot('chapter', {
        ...(typeof flatIndex === 'number' ? { flatIndex } : {}),
        ...(typeof title === 'string' ? { title } : {}),
      })
      return { content: [{ type: 'text', text }] }
    }
    case 'search': {
      const query = args?.query
      if (typeof query !== 'string' || !query.trim()) {
        return {
          content: [
            { type: 'text', text: 'inkdown_read(scope=search) 需要非空的 query 参数' },
          ],
          isError: true,
        }
      }
      const text = await context.readSnapshot('search', { query })
      return { content: [{ type: 'text', text }] }
    }
  }
}

export async function callInkdownMcpTool(
  name: string,
  context: InkdownMcpToolContext,
  args?: Record<string, unknown>,
): Promise<InkdownMcpToolResult> {
  switch (name) {
    case 'inkdown_read': {
      const scope = parseReadScope(args?.scope)
      if (!scope) {
        return {
          content: [
            {
              type: 'text',
              text: 'inkdown_read 需要 scope: toc | viewport | current | chapter | search',
            },
          ],
          isError: true,
        }
      }
      return callInkdownRead(context, scope, args)
    }
    case 'inkdown_get_toc':
      return callInkdownRead(context, 'toc', args)
    case 'inkdown_get_viewport':
      return callInkdownRead(context, 'viewport', args)
    case 'inkdown_get_current_text':
      return callInkdownRead(context, 'current', args)
    case 'inkdown_get_chapter':
      return callInkdownRead(context, 'chapter', args)
    case 'inkdown_search':
      return callInkdownRead(context, 'search', args)
    case 'inkdown_get_selection': {
      const text = await context.readSnapshot('selection')
      return { content: [{ type: 'text', text }] }
    }
    case 'inkdown_list_marks': {
      const filter = parseMarkListFilter(args?.filter)
      const text = await context.readSnapshot('marks', { filter })
      return { content: [{ type: 'text', text }] }
    }
    case 'inkdown_list_highlights': {
      const text = await context.readSnapshot('marks', { filter: 'highlights' })
      return { content: [{ type: 'text', text }] }
    }
    case 'inkdown_create_bookmark': {
      const text = await context.readSnapshot('create-bookmark')
      return { content: [{ type: 'text', text }] }
    }
    case 'inkdown_create_note':
    case 'inkdown_propose_note': {
      const note = typeof args?.note === 'string' ? args.note : ''
      const text = await context.readSnapshot('propose-mark', { note })
      return { content: [{ type: 'text', text }] }
    }
    case 'inkdown_suggest_chapters': {
      const chapters = args?.chapters
      if (!Array.isArray(chapters) || chapters.length === 0) {
        return {
          content: [{ type: 'text', text: 'inkdown_suggest_chapters 需要非空 chapters 数组' }],
          isError: true,
        }
      }
      const text = await context.readSnapshot('suggest-chapters', { chapters })
      return { content: [{ type: 'text', text }] }
    }
    case 'inkdown_propose_mark': {
      const marks = args?.marks
      const excerpt = args?.excerpt
      const noteOnly = typeof args?.note === 'string' && args.note.trim()
      if (
        (!Array.isArray(marks) || marks.length === 0) &&
        (typeof excerpt !== 'string' || !excerpt.trim()) &&
        !noteOnly
      ) {
        return {
          content: [
            {
              type: 'text',
              text: 'inkdown_propose_mark 需要 excerpt、marks 之一，或有选区时仅传 note',
            },
          ],
          isError: true,
        }
      }
      const note = typeof args?.note === 'string' ? args.note : ''
      const flatIndex = args?.flatIndex
      const kind = args?.kind
      const text = await context.readSnapshot('propose-mark', {
        ...(typeof excerpt === 'string' ? { excerpt } : {}),
        note,
        kind: kind === 'highlight' || kind === 'note' || kind === 'auto' ? kind : undefined,
        ...(typeof flatIndex === 'number' && Number.isFinite(flatIndex) ? { flatIndex } : {}),
        ...(Array.isArray(marks) ? { marks } : {}),
      })
      return { content: [{ type: 'text', text }] }
    }
    default:
      return {
        content: [{ type: 'text', text: `未知工具: ${name}` }],
        isError: true,
      }
  }
}
