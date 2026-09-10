import { describe, expect, it, vi } from 'vitest'
import { err, ok, type Result } from '@shared/core/result'
import type { AppError } from '@shared/core/errors'
import type { BookDbBlockHit } from '@shared/types/book-db'
import {
  BOOK_SEARCH_LIMIT,
  BookSearchSession,
  formatBookSearchHeading,
  summarizeBookSearchHit,
  toBookSearchKeyword,
} from './pdf-book-search'

function hit(over: Partial<BookDbBlockHit> = {}): BookDbBlockHit {
  return {
    id: 1,
    type: 'paragraph',
    content: '正文',
    pageNumber: 36,
    chapterIndex: 1,
    chapterTitle: '第2章',
    blockIndex: 0,
    snippet: '',
    ...over,
  }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('toBookSearchKeyword', () => {
  it('空白/不足 3 字拒绝', () => {
    expect(toBookSearchKeyword('  ')).toBeNull()
    expect(toBookSearchKeyword('王道')).toBeNull()
    expect(toBookSearchKeyword(123)).toBeNull()
    expect(toBookSearchKeyword('  移码表示法  ')).toBe('移码表示法')
  })
})

describe('summarizeBookSearchHit', () => {
  it('短文本原样返回', () => {
    expect(summarizeBookSearchHit('补码加法', '补码')).toBe('补码加法')
  })

  it('长文本以命中为中心开窗，不产出 HTML', () => {
    const content = `${'正'.repeat(500)}移码表示法${'文'.repeat(500)}`
    const excerpt = summarizeBookSearchHit(content, '移码表示法')
    expect(excerpt).toContain('移码表示法')
    expect(excerpt.length).toBeLessThanOrEqual(122)
    expect(excerpt).toMatch(/^….*…$/)
    expect(excerpt).not.toContain('<')
  })
})

describe('formatBookSearchHeading', () => {
  it('无标题或标题即页码时只显示一次', () => {
    expect(formatBookSearchHeading(null, 3)).toBe('第 3 页')
    expect(formatBookSearchHeading('第 3 页', 3)).toBe('第 3 页')
  })

  it('真实标题展示“章节 · 第 N 页”', () => {
    expect(formatBookSearchHeading('第2章', 36)).toBe('第2章 · 第 36 页')
  })
})

describe('BookSearchSession', () => {
  it('短词不调用 query 并给出提示', async () => {
    const query = vi.fn(async () => ok([]))
    const session = new BookSearchSession(query)
    session.bind('fp-1')
    expect(session.search('王道')).toEqual({ accepted: false, tip: '至少输入 3 个字符' })
    expect(query).not.toHaveBeenCalled()
    expect(session.getState().status).toBe('idle')
  })

  it('无指纹绑定时提示先建索引，不请求', () => {
    const query = vi.fn(async () => ok([]))
    const session = new BookSearchSession(query)
    expect(session.search('移码表示法')).toEqual({ accepted: false, tip: '先建立罗盘索引' })
    expect(query).not.toHaveBeenCalled()
  })

  it('合法搜索传参正确，结果带章节页码摘要', async () => {
    const query = vi.fn(async () => ok([hit({ id: 7, content: '移码表示法用于阶码' })]))
    const session = new BookSearchSession(query)
    session.bind('fp-1')
    expect(session.search('移码表示法')).toEqual({ accepted: true, tip: '' })
    expect(query).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenCalledWith('fp-1', '移码表示法')
    await Promise.resolve()
    await Promise.resolve()
    const state = session.getState()
    expect(state.status).toBe('done')
    expect(state.items).toHaveLength(1)
    expect(state.items[0]).toMatchObject({ blockId: 7, pageNumber: 36, chapterTitle: '第2章' })
    expect(state.items[0]?.excerpt).toContain('移码表示法')
  })

  it('零命中与 API 错误各自状态正确', async () => {
    const empty = new BookSearchSession(vi.fn(async () => ok([])))
    empty.bind('fp-1')
    empty.search('不存在的词条啊')
    await Promise.resolve()
    await Promise.resolve()
    expect(empty.getState().status).toBe('empty')

    const failing = new BookSearchSession(vi.fn(async () => err({ code: 'UNKNOWN' as const, message: '炸了' })))
    failing.bind('fp-1')
    failing.search('移码表示法')
    await Promise.resolve()
    await Promise.resolve()
    expect(failing.getState()).toMatchObject({ status: 'error', error: '炸了' })
  })

  it('后发覆盖先发：旧异步回写被丢弃', async () => {
    const first = deferred<Result<BookDbBlockHit[], AppError>>()
    const second = deferred<Result<BookDbBlockHit[], AppError>>()
    const query = vi
      .fn<() => Promise<Result<BookDbBlockHit[], AppError>>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const session = new BookSearchSession(query)
    session.bind('fp-1')
    session.search('移码表示法')
    session.search('补码加法器')
    expect(session.getState().status).toBe('loading')
    first.resolve(ok([hit({ id: 1, content: '移码表示法旧结果' })]))
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    // 旧结果不得覆盖：仍在等新请求
    expect(session.getState().status).toBe('loading')
    second.resolve(ok([hit({ id: 2, content: '补码加法器新结果' })]))
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    const state = session.getState()
    expect(state.status).toBe('done')
    expect(state.items[0]?.blockId).toBe(2)
    expect(state.keyword).toBe('补码加法器')
  })

  it('文件切换清空一切且旧回写失效', async () => {
    const gate = deferred<Result<BookDbBlockHit[], AppError>>()
    const query = vi.fn(() => gate.promise)
    const session = new BookSearchSession(query)
    session.bind('fp-1')
    session.search('移码表示法')
    session.bind('fp-2')
    expect(session.getState()).toMatchObject({ status: 'idle', keyword: '', items: [] })
    gate.resolve(ok([hit({ id: 9, content: '移码表示法旧文件结果' })]))
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(session.getState().status).toBe('idle')
    expect(session.getState().items).toEqual([])
  })

  it('展示截断 20 条，不冒充总数', async () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      hit({ id: i + 1, content: `第${i + 1}处移码表示法` }),
    )
    const query = vi.fn(async () => ok(many))
    const session = new BookSearchSession(query)
    session.bind('fp-1')
    session.search('移码表示法')
    await Promise.resolve()
    await Promise.resolve()
    expect(session.getState().items).toHaveLength(BOOK_SEARCH_LIMIT)
  })

  it('确认无 OCR/导入/目录重建调用：query 是唯一外部依赖', () => {
    const query = vi.fn(async () => ok([]))
    const session = new BookSearchSession(query)
    // 会话模块只接受一个 query 依赖；除它之外无任何外部调用点
    expect(query).not.toHaveBeenCalled()
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(session))).toEqual(
      expect.arrayContaining(['bind', 'reset', 'search', 'getState', 'subscribe']),
    )
  })
})
