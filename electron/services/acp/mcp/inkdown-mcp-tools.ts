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

const NO_ARGS_SCHEMA = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const

const READER_FORMATS =
  'EPUB/PDF/MOBI/AZW3 与在线文档（web URL，阅读模式抓取的正文）'

export const INKDOWN_MCP_TOOLS: InkdownMcpToolDefinition[] = [
  {
    name: 'inkdown_get_toc',
    description:
      `获取当前打开的 ${READER_FORMATS} 的完整目录（JSON：entries、currentIndex、document）。` +
      '仅用于阅读器文档；.md/.txt 请直接读工作区文件，不必调本工具。' +
      '用户在问章节结构、章名或阅读位置时可选调用；能直接答则不必调用。',
    inputSchema: NO_ARGS_SCHEMA,
  },
  {
    name: 'inkdown_get_viewport',
    description:
      `获取当前阅读窗口可见的纯文本（约一屏，不是整章）。EPUB/MOBI 为视口内可见块；PDF 为当前页；在线文档为当前页 iframe 视口。` +
      '【优先于整章】若线程上下文可能还不够回答「这里/这页」等问题再调用。' +
      '上文工具结果可能已够用则可直接答，不必每轮重调。体积小。',
    inputSchema: NO_ARGS_SCHEMA,
  },
  {
    name: 'inkdown_get_current_text',
    description:
      `获取当前正在阅读的整章纯文本（PDF 为当前页；在线文档为当前 URL 页），可能很长并截断。` +
      '仅当用户明确要求整章总结，或 inkdown_get_viewport / inkdown_get_selection 仍信息不足时再调用；' +
      `不要作为读正文的首选。用于 ${READER_FORMATS}。`,
    inputSchema: NO_ARGS_SCHEMA,
  },
  {
    name: 'inkdown_get_chapter',
    description:
      `按目录 flatIndex 或章节标题读取指定章/页的纯文本（不跳转阅读位置）。` +
      'index 与 inkdown_get_toc.entries[].index 一致；title 可模糊包含匹配。' +
      '在线文档按 TOC 条目 URL 抓取对应页面正文。' +
      '仅当用户明确要某一章（非当前视口）或视口/当前章不够时使用；可能很长并截断。' +
      '不要用于「这里/这页」——那些优先 viewport。',
    inputSchema: {
      type: 'object',
      properties: {
        flatIndex: {
          type: 'number',
          description: '目录条目下标（与 toc.entries[].index 相同）',
        },
        title: {
          type: 'string',
          description: '章节标题；可与 flatIndex 二选一，支持包含匹配',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'inkdown_search',
    description:
      `在当前打开的阅读文档内做关键词子串检索（忽略大小写），返回章节/页码、次数与片段。` +
      `用于 ${READER_FORMATS}；.md/.txt 请用工作区搜索或直接读文件。` +
      '关键词用原文用词；用户问「哪里提到 X」时可选调用。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '要检索的关键词，取自文档原文用词' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'inkdown_get_selection',
    description:
      '获取用户当前选中的文本。若选区较短（≤30 字），仅向前后各补约 30 字作为 excerpt。' +
      '仅当 turn-context 出现 hasSelection=true（本轮新划选）时几乎必调；无此标记时不要调。' +
      '用户划选即优先分析该段；选区通知只生效一轮；无选区时会报错。',
    inputSchema: NO_ARGS_SCHEMA,
  },
  {
    name: 'inkdown_list_marks',
    description:
      '列出当前打开文档的书签 / 高亮 / 批注（混排，含纯书签）。' +
      '用户问「我有哪些书签」或要看全部标记时调用。整理划重点请用 inkdown_list_highlights。用于 EPUB/PDF/MOBI/在线文档。',
    inputSchema: NO_ARGS_SCHEMA,
  },
  {
    name: 'inkdown_list_highlights',
    description:
      '收集当前打开文档的划重点：高亮原文，以及带摘录的批注（不含纯书签）。' +
      '按阅读位置排序；JSON 含 passages（纯摘录数组）与 highlights（text、note、color、location）。' +
      '用户要整理/汇总/导出划重点、回顾标过的句子时调用；用于 EPUB/PDF/MOBI/在线文档。',
    inputSchema: NO_ARGS_SCHEMA,
  },
  {
    name: 'inkdown_create_bookmark',
    description:
      '在当前阅读位置创建书签（不跳转）。用户明确要求「加个书签」时调用；仅 EPUB/PDF/MOBI。',
    inputSchema: NO_ARGS_SCHEMA,
  },
  {
    name: 'inkdown_create_note',
    description:
      '基于用户当前选区提出批注或高亮草稿（不会直接入库）。' +
      'note 非空为批注文案，空字符串为仅高亮。' +
      '客户端会在会话内展示提议卡，用户点击「采用」后才写入；工具结果含 proposed:true。' +
      '需要已有选区；用户要求「给这段加批注」时调用。与 inkdown_propose_note 等价。',
    inputSchema: {
      type: 'object',
      properties: {
        note: {
          type: 'string',
          description: '批注正文；省略或空字符串则只提议高亮',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'inkdown_propose_note',
    description:
      '提出批注草稿供用户确认（不入库）。参数与 inkdown_create_note 相同；优先使用本工具名称以表达「仅提议」。' +
      '需要已有选区，或配合 inkdown_propose_mark 在无选区时按 excerpt 定位。',
    inputSchema: {
      type: 'object',
      properties: {
        note: {
          type: 'string',
          description: '批注正文；省略或空字符串则只提议高亮',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'inkdown_propose_mark',
    description:
      '统一标记提议（高亮 / 批注 / 批量，不入库）。' +
      '单条：excerpt（原句或口述关键词）+ 可选 note（空=仅高亮）+ 可选 kind=highlight|note|auto + 可选 flatIndex。' +
      '批量：marks 数组（每项同单条字段，单批≤10）。' +
      '客户端读正文并模糊匹配原句；有 fresh 选区且仅写 note 时也可只传 note（等同 propose_note）。' +
      '建议先 inkdown_get_viewport；用户确认「采用」后才写入。',
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

export async function callInkdownMcpTool(
  name: string,
  context: InkdownMcpToolContext,
  args?: Record<string, unknown>,
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
    case 'inkdown_get_viewport': {
      const text = await context.readSnapshot('viewport.txt')
      return { content: [{ type: 'text', text }] }
    }
    case 'inkdown_get_chapter': {
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
              text: 'inkdown_get_chapter 需要 flatIndex 或 title 之一',
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
    case 'inkdown_search': {
      const query = args?.query
      if (typeof query !== 'string' || !query.trim()) {
        return {
          content: [{ type: 'text', text: 'inkdown_search 需要非空的 query 参数' }],
          isError: true,
        }
      }
      const text = await context.readSnapshot('search', { query })
      return { content: [{ type: 'text', text }] }
    }
    case 'inkdown_get_selection': {
      const text = await context.readSnapshot('selection')
      return { content: [{ type: 'text', text }] }
    }
    case 'inkdown_list_marks': {
      const text = await context.readSnapshot('marks')
      return { content: [{ type: 'text', text }] }
    }
    case 'inkdown_list_highlights': {
      const text = await context.readSnapshot('highlights')
      return { content: [{ type: 'text', text }] }
    }
    case 'inkdown_create_bookmark': {
      const text = await context.readSnapshot('create-bookmark')
      return { content: [{ type: 'text', text }] }
    }
    case 'inkdown_create_note':
    case 'inkdown_propose_note': {
      const note = typeof args?.note === 'string' ? args.note : ''
      const text = await context.readSnapshot(
        name === 'inkdown_propose_note' ? 'propose-note' : 'create-note',
        { note },
      )
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
