import { describe, expect, it } from 'vitest'
import {
  clearTocDraft,
  decideTocAiPromptOutcome,
  deleteTocDraftEntry,
  readTocDraft,
  sanitizeTocDraftEntry,
  takeTocDraft,
  upsertTocDraftEntry,
  writeTocDraft,
} from './toc-draft'

describe('toc-draft', () => {
  it('sanitize 与 toc-ai 解析同口径（工具 1-based 转存 0-based）', () => {
    expect(sanitizeTocDraftEntry({ title: ' 3.1 组成 ', printedPage: '31', level: '2' })).toEqual({
      title: '3.1 组成',
      printedPage: 31,
      level: 1,
      source: 'ai',
    })
    expect(sanitizeTocDraftEntry({ title: '', printedPage: 1 })).toBeNull()
    expect(sanitizeTocDraftEntry({ title: '正文', printedPage: 0 })).toBeNull()
    expect(sanitizeTocDraftEntry({ title: '87929797王道计', printedPage: 149 })).toBeNull()
    expect(sanitizeTocDraftEntry({ title: '深层', printedPage: 3, level: 99 })?.level).toBe(6)
  })

  it('整单替换幂等并计丢弃', () => {
    clearTocDraft()
    const result = writeTocDraft('fp-1', [
      { title: '第1章', printedPage: 1, level: 1 },
      { title: '', printedPage: 2 },
      { title: '87929797王道计', printedPage: 3 },
    ])
    expect(result).toEqual({ count: 1, dropped: 2 })
    expect(readTocDraft()?.entries).toHaveLength(1)
  })

  it('缺页码节父项跟随后继、无号章行丢弃', () => {
    clearTocDraft()
    const result = writeTocDraft('fp-1', [
      { title: '第3章 存储系统', level: 1 },
      { title: '3.1 主存储器', level: 1 },
      { title: '3.1.1 概述', printedPage: 45, level: 2 },
    ])
    expect(result).toEqual({ count: 2, dropped: 1 })
    expect(readTocDraft()?.entries).toEqual([
      { title: '3.1 主存储器', printedPage: 45, level: 0, source: 'ai' },
      { title: '3.1.1 概述', printedPage: 45, level: 1, source: 'ai' },
    ])
  })

  it('同级兄弟缺页不回填（防涂抹），仅父子继承', () => {
    clearTocDraft()
    const siblings = writeTocDraft('fp-1', [
      { title: '3.1 父项', level: 1 },
      { title: '3.2 父项', level: 1 },
      { title: '3.3 父项', level: 1 },
      { title: '3.4 父项', level: 1 },
      { title: '3.5 落点', printedPage: 45, level: 1 },
    ])
    // 同级不同页：继承必错位，只留落点
    expect(siblings.count).toBe(1)
    expect(siblings.dropped).toBe(4)
    clearTocDraft()
    const parent = writeTocDraft('fp-1', [
      { title: '3.1 父项', level: 1 },
      { title: '3.1.1 落点', printedPage: 45, level: 2 },
    ])
    expect(parent.count).toBe(2)
  })

  it('upsert 同标题更新、异标题追加', () => {
    clearTocDraft()
    writeTocDraft('fp-1', [{ title: '第1章', printedPage: 1, level: 1 }])
    expect(upsertTocDraftEntry('fp-1', { title: '第1章', printedPage: 2, level: 1 })).toMatchObject({
      action: 'updated',
      count: 1,
    })
    expect(upsertTocDraftEntry('fp-1', { title: '1.1', printedPage: 2, level: 2 })).toMatchObject({
      action: 'added',
      count: 2,
    })
    expect(readTocDraft()?.entries[0]).toMatchObject({ printedPage: 2 })
    expect(upsertTocDraftEntry('fp-1', { title: '', printedPage: 1 })).toHaveProperty('error')
  })

  it('按序号/标题删除', () => {
    clearTocDraft()
    writeTocDraft('fp-1', [
      { title: 'A', printedPage: 1, level: 1 },
      { title: 'B', printedPage: 2, level: 1 },
    ])
    expect(deleteTocDraftEntry('fp-1', { index: 5 })).toEqual({ removed: 0, count: 2 })
    expect(deleteTocDraftEntry('fp-1', { title: 'A' })).toEqual({ removed: 1, count: 1 })
    expect(deleteTocDraftEntry('other-fp', { index: 0 })).toEqual({ removed: 0, count: 1 })
  })

  it('工具草稿 + 空文字回复 => 用工具草稿（零正文 agent 不丢稿）', () => {
    clearTocDraft()
    writeTocDraft('fp-1', [{ title: '1.2.3软件', printedPage: 4, level: 2 }])
    const drafted = takeTocDraft('fp-1')
    expect(
      decideTocAiPromptOutcome(drafted !== null, false),
    ).toEqual({ action: 'apply-draft', source: 'tool' })
  })

  it('无工具草稿 + 空文字回复 => AI 无回复', () => {
    clearTocDraft()
    const drafted = takeTocDraft('fp-1')
    expect(decideTocAiPromptOutcome(drafted !== null, false)).toEqual({ action: 'no-reply' })
  })

  it('工具草稿 + 有文字回复 => 工具草稿优先（不双算）', () => {
    clearTocDraft()
    writeTocDraft('fp-1', [{ title: '1.2.3软件', printedPage: 4, level: 2 }])
    const drafted = takeTocDraft('fp-1')
    expect(decideTocAiPromptOutcome(drafted !== null, true)).toEqual({
      action: 'apply-draft',
      source: 'tool',
    })
    // 取即清空：同一份草稿不会被 JSON 回退再消费一次
    expect(takeTocDraft('fp-1')).toBeNull()
  })

  it('指纹不符草稿不被消费（保留给对的书）', () => {
    clearTocDraft()
    writeTocDraft('fp-1', [{ title: '1.2.3软件', printedPage: 4, level: 2 }])
    expect(takeTocDraft('other-fp')).toBeNull()
    expect(
      decideTocAiPromptOutcome(takeTocDraft('other-fp') !== null, false),
    ).toEqual({ action: 'no-reply' })
    expect(readTocDraft()?.entries).toHaveLength(1)
  })

  it('take 指纹一致才给且取即清空，不符保留', () => {
    clearTocDraft()
    expect(takeTocDraft('fp-1')).toBeNull()
    writeTocDraft('fp-1', [{ title: 'A', printedPage: 1, level: 1 }])
    expect(takeTocDraft('other-fp')).toBeNull()
    expect(readTocDraft()?.entries).toHaveLength(1)
    expect(takeTocDraft('fp-1')).toHaveLength(1)
    expect(readTocDraft()).toBeNull()
  })
})
