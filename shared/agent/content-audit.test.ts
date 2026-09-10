import { describe, expect, it } from 'vitest'
import {
  CONTENT_AUDIT_MAX_HITS,
  normalizeContentAuditQuery,
  parseContentAuditLimit,
  resolveContentAuditMatchPosition,
  windowContentAuditText,
} from './content-audit'

describe('parseContentAuditLimit', () => {
  it('缺省 10，边界 1/10 通过', () => {
    expect(parseContentAuditLimit(undefined)).toBe(10)
    expect(parseContentAuditLimit(null)).toBe(10)
    expect(parseContentAuditLimit(1)).toBe(1)
    expect(parseContentAuditLimit(10)).toBe(10)
  })

  it('越界与非整数拒绝', () => {
    expect(parseContentAuditLimit(0)).toBeNull()
    expect(parseContentAuditLimit(11)).toBeNull()
    expect(parseContentAuditLimit(1.5)).toBeNull()
    expect(parseContentAuditLimit(Number.NaN)).toBeNull()
    expect(parseContentAuditLimit('10')).toBeNull()
  })
})

describe('normalizeContentAuditQuery', () => {
  it('去空白后至少 3 字符', () => {
    expect(normalizeContentAuditQuery('  王道计  ')).toBe('王道计')
    expect(normalizeContentAuditQuery('ab')).toBeNull()
    expect(normalizeContentAuditQuery('   ')).toBeNull()
    expect(normalizeContentAuditQuery(123)).toBeNull()
  })
})

describe('resolveContentAuditMatchPosition', () => {
  it('start：命中贴着开头（前导空白容忍）', () => {
    expect(resolveContentAuditMatchPosition('王道计是出版社', '王道计')).toBe('start')
    expect(resolveContentAuditMatchPosition('  王道计是出版社', '王道计')).toBe('start')
  })

  it('end：命中贴着结尾', () => {
    expect(resolveContentAuditMatchPosition('出版社是王道计', '王道计')).toBe('end')
    expect(resolveContentAuditMatchPosition('出版社是王道计  ', '王道计')).toBe('end')
  })

  it('middle：命中在中间', () => {
    expect(resolveContentAuditMatchPosition('这本王道计的书', '王道计')).toBe('middle')
  })

  it('multiple：多处命中（含首尾各一）', () => {
    expect(resolveContentAuditMatchPosition('王道计好王道计', '王道计')).toBe('multiple')
    expect(resolveContentAuditMatchPosition('说王道计，再说王道计一次', '王道计')).toBe('multiple')
  })

  it('大小写不敏感，原文不改写', () => {
    expect(resolveContentAuditMatchPosition('BILIBILI 搜索', 'bilibili')).toBe('start')
  })
})

describe('windowContentAuditText', () => {
  it('短文本原样返回不截断', () => {
    expect(windowContentAuditText('王道计', '王道计', 1200)).toEqual({
      text: '王道计',
      truncated: false,
    })
  })

  it('长文本以命中为中心开窗且命中必在窗内', () => {
    const text = `${'正'.repeat(2000)}王道计${'文'.repeat(2000)}`
    const { text: windowed, truncated } = windowContentAuditText(text, '王道计', 1200)
    expect(truncated).toBe(true)
    expect(windowed.length).toBe(1200)
    expect(windowed).toContain('王道计')
  })

  it('命中在尾部时窗口贴着结尾', () => {
    const text = `${'正'.repeat(3000)}王道计`
    const { text: windowed, truncated } = windowContentAuditText(text, '王道计', 1200)
    expect(truncated).toBe(true)
    expect(windowed.endsWith('王道计')).toBe(true)
    expect(windowed.length).toBe(CONTENT_AUDIT_MAX_HITS * 120)
  })
})
