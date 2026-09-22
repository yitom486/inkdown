import { describe, expect, it } from 'vitest'
import { buildInkdownPromptPrefix } from './build-prompt-prefix'
import {
  INKDOWN_BOOTSTRAP_CLOSE_TAG,
  INKDOWN_BOOTSTRAP_OPEN_TAG,
  INKDOWN_CLIENT_CLOSE_TAG,
  INKDOWN_CLIENT_OPEN_TAG,
  INKDOWN_STATIC_SKILL,
  INKDOWN_TOOL_OVERVIEW,
} from './inkdown-static-skill'
import {
  formatTurnContextBlock,
  INKDOWN_TURN_CONTEXT_CLOSE_TAG,
  INKDOWN_TURN_CONTEXT_OPEN_TAG,
} from './turn-context'
import {
  hasReplayScaffoldingMarkers,
  stripReplayScaffolding,
} from './strip-replay-scaffolding'

const TURN_JSON = JSON.stringify({
  documentChanged: false,
  activeDocument: { path: '/books/dune.epub', kind: 'epub', name: 'dune.epub' },
  reading: { percent: 42, current: '第七章' },
})
const TURN_BLOCK = `${INKDOWN_TURN_CONTEXT_OPEN_TAG}\n${TURN_JSON}\n${INKDOWN_TURN_CONTEXT_CLOSE_TAG}`
const BOOTSTRAP_SKILL =
  `${INKDOWN_BOOTSTRAP_OPEN_TAG}\n${INKDOWN_STATIC_SKILL}\n${INKDOWN_BOOTSTRAP_CLOSE_TAG}`
const BOOTSTRAP_OVERVIEW =
  `${INKDOWN_BOOTSTRAP_OPEN_TAG}\n${INKDOWN_TOOL_OVERVIEW}\n${INKDOWN_BOOTSTRAP_CLOSE_TAG}`

describe('stripReplayScaffolding', () => {
  it('无标记原文逐字不动（同一引用）', () => {
    const text = '你好，请总结这一章'
    const result = stripReplayScaffolding(text)
    expect(result.text).toBe(text)
    expect(result.dangling).toBe(false)
    expect(hasReplayScaffoldingMarkers(text)).toBe(false)
  })

  it('整段剥离 bootstrap + turn-context，只剩用户原文', () => {
    const replay = `${BOOTSTRAP_SKILL}\n${BOOTSTRAP_OVERVIEW}\n${TURN_BLOCK}\n你好`
    const result = stripReplayScaffolding(replay)
    expect(result.text).toBe('你好')
    expect(result.dangling).toBe(false)
  })

  it('截图原样：bootstrap 尾片（孤儿 closing）+ turn-context JSON + 你好 → 只剩“你好”', () => {
    // cursor load 把发过的内容重播进 user 气泡，chunk 开头是上一块的残片：
    // "## Other conventions …" 是静态 Skill 尾部，opening 留在更早的 chunk。
    const tail = [
      'keep diffs small.',
      INKDOWN_CLIENT_CLOSE_TAG,
      INKDOWN_BOOTSTRAP_CLOSE_TAG,
      TURN_BLOCK,
      '你好',
    ].join('\n')
    const replay = `## Other conventions\n\n- "This chapter / this page / this book" defaults to the document in turn-context.\n- When editing workspace files, match existing style; ${tail}`
    const result = stripReplayScaffolding(replay)
    expect(result.text).toBe('你好')
    expect(result.dangling).toBe(false)
  })

  it('跨 chunk 撕裂：opening 悬垂截断，续接下一 chunk 再洗得原文', () => {
    // turn-context JSON 从中间劈开：chunk1 以未闭合 opening 结尾
    const cut = Math.floor(TURN_BLOCK.length / 2)
    const chunk1 = `你好\n${TURN_BLOCK.slice(0, cut)}`
    const chunk2 = `${TURN_BLOCK.slice(cut)}\n谢谢`
    expect(chunk1).toContain(INKDOWN_TURN_CONTEXT_OPEN_TAG)
    expect(chunk1).not.toContain(INKDOWN_TURN_CONTEXT_CLOSE_TAG)

    const first = stripReplayScaffolding(chunk1)
    expect(first.dangling).toBe(true)
    // 调用方缓存的是原文（非清洗后的前缀），与下一 chunk 拼接后重洗
    const second = stripReplayScaffolding(chunk1 + chunk2)
    expect(second.dangling).toBe(false)
    expect(second.text).toBe('你好\n\n谢谢')
  })

  it('跨 chunk 撕裂：纯脚手架 chunk 悬垂，续接后洗空即丢弃', () => {
    const cut = Math.floor(BOOTSTRAP_OVERVIEW.length / 2)
    const chunk1 = BOOTSTRAP_OVERVIEW.slice(0, cut)
    const chunk2 = BOOTSTRAP_OVERVIEW.slice(cut)
    const first = stripReplayScaffolding(chunk1)
    expect(first.dangling).toBe(true)
    const second = stripReplayScaffolding(chunk1 + chunk2)
    expect(second.dangling).toBe(false)
    expect(second.text).toBe('')
  })

  it('洗空即丢弃：纯脚手架整段 → 空串', () => {
    expect(stripReplayScaffolding(TURN_BLOCK).text).toBe('')
    expect(stripReplayScaffolding(`${BOOTSTRAP_OVERVIEW}\n${TURN_BLOCK}`).text).toBe('')
  })

  it('多轮脚手架相邻多段一次剥净', () => {
    const replay = `${TURN_BLOCK}\n第一问\n${TURN_BLOCK}\n第二问`
    expect(stripReplayScaffolding(replay).text).toBe('第一问\n\n第二问')
  })
})

describe('bootstrap 稳定标记（前后文本一致性：包含关系）', () => {
  it('静态 Skill 自带 client 内层标记', () => {
    expect(INKDOWN_STATIC_SKILL.startsWith(INKDOWN_CLIENT_OPEN_TAG)).toBe(true)
    expect(INKDOWN_STATIC_SKILL.trimEnd().endsWith(INKDOWN_CLIENT_CLOSE_TAG)).toBe(true)
  })

  it('buildInkdownPromptPrefix 用 bootstrap 外层包裹且内层语义逐字保留', () => {
    const blocks = buildInkdownPromptPrefix('test-thread-strip', { includeBootstrap: true })
    const texts = blocks.map((b) => (b.type === 'text' ? b.text : ''))
    const skillBlock = texts.find((t) => t.includes(INKDOWN_CLIENT_OPEN_TAG))
    expect(skillBlock).toBeDefined()
    expect(skillBlock!.startsWith(INKDOWN_BOOTSTRAP_OPEN_TAG)).toBe(true)
    expect(skillBlock!.trimEnd().endsWith(INKDOWN_BOOTSTRAP_CLOSE_TAG)).toBe(true)
    // 只加标记不改指令语义：新文本包含旧文本全文
    expect(skillBlock).toContain(INKDOWN_STATIC_SKILL)

    const overviewBlock = texts.find((t) => t.includes(INKDOWN_TOOL_OVERVIEW))
    expect(overviewBlock).toBeDefined()
    expect(overviewBlock!.startsWith(INKDOWN_BOOTSTRAP_OPEN_TAG)).toBe(true)
    expect(overviewBlock!.trimEnd().endsWith(INKDOWN_BOOTSTRAP_CLOSE_TAG)).toBe(true)
  })

  it('发送前缀整体可被清洗：prefix + turn + 原文 → 只剩原文', () => {
    const turn = formatTurnContextBlock({
      documentChanged: true,
      activeDocument: { path: '/books/dune.epub', kind: 'epub', name: 'dune.epub' },
      reading: { percent: 42, current: '第七章' },
    })
    const replay = `${BOOTSTRAP_SKILL}\n${BOOTSTRAP_OVERVIEW}\n${turn}\n帮我总结`
    expect(stripReplayScaffolding(replay).text).toBe('帮我总结')
  })
})
