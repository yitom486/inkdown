import { describe, expect, it } from 'vitest'
import {
  TOC_DRAFT_GUARD_MESSAGE,
  canBeginTocOp,
  createTocOpLock,
  tocBusyMessage,
  type OcrTocOperation,
} from './ocr-toc-op'

const OPS: OcrTocOperation[] = ['detect', 'recognize', 'save']

describe('ocr-toc-op 互斥矩阵', () => {
  it('空闲时三操作都可开始', () => {
    for (const next of OPS) {
      expect(canBeginTocOp(null, next)).toBe(true)
    }
    expect(tocBusyMessage(null)).toBeNull()
  })

  it.each([
    ['detect', 'detect'],
    ['detect', 'recognize'],
    ['detect', 'save'],
    ['recognize', 'detect'],
    ['recognize', 'recognize'],
    ['recognize', 'save'],
    ['save', 'detect'],
    ['save', 'recognize'],
    ['save', 'save'],
  ] as [OcrTocOperation, OcrTocOperation][])('运行中 %s 时 %s 不得开始并给出忙提示', (running, next) => {
    expect(canBeginTocOp(running, next)).toBe(false)
    expect(tocBusyMessage(running)).toContain('进行中')
  })
})

describe('createTocOpLock 同步协议（无渲染延迟，快速连点也绕不过）', () => {
  it('连续两次 tryBegin：第一次成功，第二次失败', () => {
    const lock = createTocOpLock()
    expect(lock.tryBegin('detect')).toBe(true)
    expect(lock.tryBegin('recognize')).toBe(false)
    expect(lock.current()).toBe('detect')
  })

  it('失败/参数错误后 end 即释放，可再次操作', () => {
    const lock = createTocOpLock()
    expect(lock.tryBegin('recognize')).toBe(true)
    lock.end('recognize')
    expect(lock.current()).toBeNull()
    expect(lock.tryBegin('save')).toBe(true)
    expect(lock.current()).toBe('save')
  })

  it('别人的 end 是空操作，不能偷走锁', () => {
    const lock = createTocOpLock()
    expect(lock.tryBegin('save')).toBe(true)
    lock.end('detect')
    expect(lock.current()).toBe('save')
    expect(lock.tryBegin('detect')).toBe(false)
  })

  it('重复 end 幂等', () => {
    const lock = createTocOpLock()
    lock.end('detect')
    expect(lock.current()).toBeNull()
    expect(lock.tryBegin('detect')).toBe(true)
    lock.end('detect')
    lock.end('detect')
    expect(lock.current()).toBeNull()
  })
})

describe('草稿保护文案', () => {
  it('要求先保存或取消（非静默覆盖）', () => {
    expect(TOC_DRAFT_GUARD_MESSAGE).toContain('保存')
    expect(TOC_DRAFT_GUARD_MESSAGE).toContain('取消')
  })
})
