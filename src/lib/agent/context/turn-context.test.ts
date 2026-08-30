import { describe, expect, it } from 'vitest'
import { INKDOWN_STATIC_SKILL } from './inkdown-static-skill'
import {
  documentKey,
  formatTurnContextBlock,
  TURN_CONTEXT_MAX_CHARS,
  type InkdownTurnContext,
} from './turn-context'

const sample: InkdownTurnContext = {
  documentChanged: true,
  activeDocument: { path: '/books/dune.epub', kind: 'epub', name: 'dune.epub' },
  reading: { percent: 42, current: '第七章', previous: '第六章', next: '第八章', unitCount: 30 },
}

describe('formatTurnContextBlock', () => {
  it('输出可解析的 JSON 并带标签包裹', () => {
    const text = formatTurnContextBlock(sample)
    expect(text.startsWith('<inkdown-turn-context>')).toBe(true)
    expect(text.endsWith('</inkdown-turn-context>')).toBe(true)

    const json = text.slice(text.indexOf('\n') + 1, text.lastIndexOf('\n'))
    expect(JSON.parse(json)).toMatchObject({
      documentChanged: true,
      activeDocument: { kind: 'epub' },
      reading: { percent: 42, current: '第七章' },
    })
  })

  it('丢弃 undefined 的阅读字段', () => {
    const text = formatTurnContextBlock({
      documentChanged: false,
      activeDocument: { path: '/a.md', kind: 'markdown', name: 'a.md' },
      reading: { percent: undefined, current: undefined },
    })
    expect(text).not.toContain('reading')
  })

  it('超长时逐级退化到体积上限内', () => {
    const long = 'x'.repeat(5000)
    const text = formatTurnContextBlock({
      documentChanged: true,
      activeDocument: { path: `/books/${long}.epub`, kind: 'epub', name: `${long}.epub` },
      reading: { percent: 10, current: long, previous: long, next: long },
    })
    expect(text.length).toBeLessThanOrEqual(TURN_CONTEXT_MAX_CHARS)
  })

  it('含 tocTopLevel 时仍可解析，超长时优先丢掉该字段', () => {
    const titles = Array.from({ length: 10 }, (_, i) => `很长的章名${'字'.repeat(40)}${i}`)
    const text = formatTurnContextBlock({
      ...sample,
      tocTopLevel: titles,
    })
    expect(text.length).toBeLessThanOrEqual(TURN_CONTEXT_MAX_CHARS)
    const json = JSON.parse(text.slice(text.indexOf('\n') + 1, text.lastIndexOf('\n'))) as {
      tocTopLevel?: string[]
    }
    // 10 条超长标题会超限，应退化掉 tocTopLevel 仍保留文件信息
    expect(json).toMatchObject({ activeDocument: { kind: 'epub' } })
  })
})

describe('documentKey', () => {
  it('区分路径与格式，未打开为 null', () => {
    expect(documentKey(null)).toBeNull()
    expect(documentKey({ path: '/a.md', kind: 'markdown', name: 'a.md' })).toBe(
      'markdown:/a.md',
    )
  })
})

describe('INKDOWN_STATIC_SKILL', () => {
  it('保持全静态：不含路径、时间戳等动态占位', () => {
    expect(INKDOWN_STATIC_SKILL).not.toMatch(/\{\{|\$\{|%s/)
    expect(INKDOWN_STATIC_SKILL).toBe(INKDOWN_STATIC_SKILL.trim())
  })

  it('明确禁止 Agent 自行解析电子书，并区分纯文本走原生读', () => {
    expect(INKDOWN_STATIC_SKILL).toContain('.epub')
    expect(INKDOWN_STATIC_SKILL).toContain('turn-context')
    expect(INKDOWN_STATIC_SKILL).toContain('Soft cues')
    expect(INKDOWN_STATIC_SKILL).toContain('normal workspace file read/write')
    expect(INKDOWN_STATIC_SKILL).toContain('Do **not** call tools only to "prove"')
    expect(INKDOWN_STATIC_SKILL).toContain('inkdown_list_marks')
    expect(INKDOWN_STATIC_SKILL).toContain('inkdown_list_highlights')
    expect(INKDOWN_STATIC_SKILL).toContain('tocTopLevel')
    expect(INKDOWN_STATIC_SKILL).toContain('「选区」')
    expect(INKDOWN_STATIC_SKILL).toContain('Match the **language of the user')
    expect(INKDOWN_STATIC_SKILL).not.toContain('默认使用简体中文')
  })
})
