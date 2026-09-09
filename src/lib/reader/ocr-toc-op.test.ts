import { describe, expect, it } from 'vitest'
import {
  TOC_DRAFT_GUARD_MESSAGE,
  TocDocLifecycle,
  canBeginTocOp,
  createTocOpLock,
  isLiveTocOpLease,
  tocBusyMessage,
  type OcrTocOperation,
  type TocOpLease,
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
    const lock = createTocOpLock()
    const lease = lock.tryBegin(running)
    expect(lease).not.toBeNull()
    expect(canBeginTocOp(lock.current(), next)).toBe(false)
    expect(tocBusyMessage(lock.current())).toContain('进行中')
    expect(lock.end(lease as TocOpLease)).toBe(true)
  })
})

describe('createTocOpLock 租约协议（无渲染延迟，快速连点也绕不过）', () => {
  it('连续两次 tryBegin：第一次拿租约，第二次拿 null', () => {
    const lock = createTocOpLock()
    const first = lock.tryBegin('detect')
    expect(first).not.toBeNull()
    expect(lock.tryBegin('recognize')).toBeNull()
    expect(lock.current()).toBe(first)
  })

  it('租约 id 单调递增且操作名一致', () => {
    const lock = createTocOpLock()
    const first = lock.tryBegin('recognize') as TocOpLease
    lock.end(first)
    const second = lock.tryBegin('save') as TocOpLease
    expect(second.id).toBeGreaterThan(first.id)
    expect(second.operation).toBe('save')
  })

  it('失败后 end 即释放，可再次操作', () => {
    const lock = createTocOpLock()
    const lease = lock.tryBegin('recognize') as TocOpLease
    expect(lock.end(lease)).toBe(true)
    expect(lock.current()).toBeNull()
    expect(lock.tryBegin('save')).not.toBeNull()
  })

  it('别人的 end 是空操作，返回 false 且抢不走锁', () => {
    const lock = createTocOpLock()
    const mine = lock.tryBegin('save') as TocOpLease
    const other = createTocOpLock().tryBegin('save') as TocOpLease
    expect(lock.end(other)).toBe(false)
    expect(lock.current()).toBe(mine)
    expect(lock.tryBegin('detect')).toBeNull()
  })

  it('重复 end 幂等：第二次返回 false', () => {
    const lock = createTocOpLock()
    const lease = lock.tryBegin('detect') as TocOpLease
    expect(lock.end(lease)).toBe(true)
    expect(lock.end(lease)).toBe(false)
    expect(lock.current()).toBeNull()
  })
})

describe('ABA：切文件 invalidate 后旧 finally 不得释放新租约', () => {
  it('A recognize → 切文件 → B recognize → A.end：B 锁仍在', () => {
    const lock = createTocOpLock()
    const leaseA = lock.tryBegin('recognize') as TocOpLease
    // 切文件：作废当前租约
    lock.invalidate()
    expect(lock.current()).toBeNull()
    const leaseB = lock.tryBegin('recognize') as TocOpLease
    expect(leaseB).not.toBeNull()
    expect(leaseB).not.toBe(leaseA)
    // 旧任务 finally：按操作名在旧实现里会误释放；租约模型下是空操作
    expect(lock.end(leaseA)).toBe(false)
    expect(lock.current()).toBe(leaseB)
    expect(canBeginTocOp(lock.current(), 'save')).toBe(false)
  })

  it('invalidate 后旧租约彻底失效，新租约 id 继续单调', () => {
    const lock = createTocOpLock()
    const leaseA = lock.tryBegin('detect') as TocOpLease
    lock.invalidate()
    const leaseB = lock.tryBegin('detect') as TocOpLease
    expect(leaseB.id).toBeGreaterThan(leaseA.id)
    expect(lock.end(leaseA)).toBe(false)
    expect(lock.end(leaseB)).toBe(true)
  })
})

describe('isLiveTocOpLease 回写门', () => {
  it('同租约同世代才放行', () => {
    const lock = createTocOpLock()
    const lease = lock.tryBegin('recognize') as TocOpLease
    expect(isLiveTocOpLease(lock.current(), lease, 7, 7)).toBe(true)
  })

  it('租约被顶替（同操作也不行）→ 拦下', () => {
    const lock = createTocOpLock()
    const leaseA = lock.tryBegin('recognize') as TocOpLease
    lock.invalidate()
    const leaseB = lock.tryBegin('recognize') as TocOpLease
    expect(isLiveTocOpLease(lock.current(), leaseA, 8, 7)).toBe(false)
    expect(isLiveTocOpLease(lock.current(), leaseB, 8, 8)).toBe(true)
  })

  it('世代已变（切过文件）→ 拦下，旧 busy 不得清新 busy', () => {
    const lock = createTocOpLock()
    const leaseA = lock.tryBegin('save') as TocOpLease
    // 切文件：世代 7→8，锁作废；新文件开始自己的 save
    lock.invalidate()
    const leaseB = lock.tryBegin('save') as TocOpLease
    // 旧任务视角：世代对不上，回写与清 busy 一律拦下
    expect(isLiveTocOpLease(lock.current(), leaseA, 8, 7)).toBe(false)
    // 新任务视角：放行
    expect(isLiveTocOpLease(lock.current(), leaseB, 8, 8)).toBe(true)
    expect(lock.current()).toBe(leaseB)
  })

  it('租约为 null 永不放行', () => {
    expect(isLiveTocOpLease(null, null, 1, 1)).toBe(false)
  })
})

describe('TocDocLifecycle 切文件交错', () => {
  it('A recognize → 切到 B（data 未到）→ A 回写门关闭', () => {
    const lifecycle = new TocDocLifecycle()
    const leaseA = lifecycle.begin('recognize') as TocOpLease
    const sessionA = lifecycle.currentSession()
    expect(lifecycle.isLive(leaseA, sessionA)).toBe(true)
    // 切到 B：B 的 data 尚未到达，但切换边界已推进
    lifecycle.switchDocument()
    expect(lifecycle.isLive(leaseA, sessionA)).toBe(false)
    expect(lifecycle.current()).toBeNull()
    expect(lifecycle.isBusy()).toBe(false)
  })

  it('B 读取失败：A 的 lease 无效，busy 无残留，新操作可开始', () => {
    const lifecycle = new TocDocLifecycle()
    const leaseA = lifecycle.begin('recognize') as TocOpLease
    lifecycle.switchDocument()
    // B 读取失败：没有任何新操作，锁必须空、busy 必须无
    expect(lifecycle.end(leaseA)).toBe(false)
    expect(lifecycle.current()).toBeNull()
    expect(lifecycle.isBusy()).toBe(false)
    expect(lifecycle.begin('detect')).not.toBeNull()
  })

  it('新文件同名 recognize 后，A 的 finally 不能释放 B 的 lease 或清 B 的 busy', () => {
    const lifecycle = new TocDocLifecycle()
    const leaseA = lifecycle.begin('recognize') as TocOpLease
    const sessionA = lifecycle.currentSession()
    lifecycle.switchDocument()
    const sessionB = lifecycle.currentSession()
    expect(sessionB).toBeGreaterThan(sessionA)
    const leaseB = lifecycle.begin('recognize') as TocOpLease
    expect(leaseB).not.toBe(leaseA)
    // A 的 finally：end 空操作，回写门关闭
    expect(lifecycle.end(leaseA)).toBe(false)
    expect(lifecycle.current()).toBe(leaseB)
    expect(lifecycle.isBusy()).toBe(true)
    expect(lifecycle.isLive(leaseA, sessionA)).toBe(false)
    expect(lifecycle.isLive(leaseB, sessionB)).toBe(true)
    // B 正常结束：释放并可再开始
    expect(lifecycle.end(leaseB)).toBe(true)
    expect(lifecycle.isBusy()).toBe(false)
    expect(lifecycle.begin('save')).not.toBeNull()
  })

  it('正常切换（无在途操作）与正常完成不受影响', () => {
    const lifecycle = new TocDocLifecycle()
    lifecycle.switchDocument()
    const lease = lifecycle.begin('detect') as TocOpLease
    const session = lifecycle.currentSession()
    expect(lifecycle.isLive(lease, session)).toBe(true)
    expect(lifecycle.end(lease)).toBe(true)
    expect(lifecycle.begin('save')).not.toBeNull()
  })
})

describe('草稿保护文案', () => {
  it('要求先保存或取消（非静默覆盖）', () => {
    expect(TOC_DRAFT_GUARD_MESSAGE).toContain('保存')
    expect(TOC_DRAFT_GUARD_MESSAGE).toContain('取消')
  })
})
