import { describe, expect, it } from 'vitest'
import {
  createTurnContextTrackerState,
  decideTurnContext,
  TURN_CONTEXT_INTERVAL,
  type TurnContextTrackerState,
} from './should-attach-turn-context'

function runTurns(
  state: TurnContextTrackerState,
  keys: Array<string | null>,
  interval = TURN_CONTEXT_INTERVAL,
): { attaches: boolean[]; state: TurnContextTrackerState } {
  const attaches: boolean[] = []
  let current = state
  for (const key of keys) {
    const decision = decideTurnContext(current, key, interval)
    attaches.push(decision.attach)
    current = decision.next
  }
  return { attaches, state: current }
}

describe('decideTurnContext', () => {
  it('首轮打开文档时附加，并标记为已变更', () => {
    const decision = decideTurnContext(createTurnContextTrackerState(), 'epub:/books/a.epub')
    expect(decision.attach).toBe(true)
    expect(decision.documentChanged).toBe(true)
  })

  it('首轮没有打开文档时不附加', () => {
    const decision = decideTurnContext(createTurnContextTrackerState(), null)
    expect(decision.attach).toBe(false)
  })

  it('同一文档下每隔 interval 轮附加一次', () => {
    const key = 'markdown:/notes/a.md'
    const { attaches } = runTurns(createTurnContextTrackerState(), Array(11).fill(key), 5)
    // 第 1 轮首次附加，其后每 5 轮一次
    expect(attaches).toEqual([
      true,
      false,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      false,
      true,
    ])
  })

  it('换文件立即附加并清零计数', () => {
    const first = decideTurnContext(createTurnContextTrackerState(), 'markdown:/a.md')
    const second = decideTurnContext(first.next, 'markdown:/a.md', 5)
    expect(second.attach).toBe(false)

    const switched = decideTurnContext(second.next, 'epub:/b.epub', 5)
    expect(switched.attach).toBe(true)
    expect(switched.documentChanged).toBe(true)
    expect(switched.next.turnsSinceAttach).toBe(0)

    // 清零后要再走满 interval 才会重复附加
    const { attaches } = runTurns(switched.next, Array(5).fill('epub:/b.epub'), 5)
    expect(attaches).toEqual([false, false, false, false, true])
  })

  it('关闭文档同样视为变更', () => {
    const opened = decideTurnContext(createTurnContextTrackerState(), 'pdf:/a.pdf')
    const closed = decideTurnContext(opened.next, null)
    expect(closed.attach).toBe(true)
    expect(closed.documentChanged).toBe(true)
  })

  it('有选区时也附加 turn-context', () => {
    const decision = decideTurnContext(createTurnContextTrackerState(), 'epub:/a.epub', 5, true)
    expect(decision.attach).toBe(true)
  })

  it('T2：同文档 pdf:19 连聊，首轮 attach，其后到 interval 才再 attach', () => {
    let state = createTurnContextTrackerState()
    const attaches: boolean[] = []
    for (let turn = 0; turn < 6; turn += 1) {
      const decision = decideTurnContext(state, 'pdf:/a.pdf', 5, false, 'pdf:19')
      attaches.push(decision.attach)
      state = decision.next
    }
    expect(attaches).toEqual([true, false, false, false, false, true])
    expect(state.lastLocationKey).toBe('pdf:19')
  })

  it('T2：19→20 未满 5 轮也 attach，且 documentChanged 为 false', () => {
    let state = createTurnContextTrackerState()
    state = decideTurnContext(state, 'pdf:/a.pdf', 5, false, 'pdf:19').next
    state = decideTurnContext(state, 'pdf:/a.pdf', 5, false, 'pdf:19').next
    const moved = decideTurnContext(state, 'pdf:/a.pdf', 5, false, 'pdf:20')
    expect(moved.attach).toBe(true)
    expect(moved.documentChanged).toBe(false)
    expect(moved.next.lastLocationKey).toBe('pdf:20')
    expect(moved.next.turnsSinceAttach).toBe(0)
  })

  it('T2：同页再发不 attach，lastLocationKey 不变', () => {
    let state = createTurnContextTrackerState()
    state = decideTurnContext(state, 'pdf:/a.pdf', 5, false, 'pdf:20').next
    const again = decideTurnContext(state, 'pdf:/a.pdf', 5, false, 'pdf:20')
    expect(again.attach).toBe(false)
    expect(again.next.lastLocationKey).toBe('pdf:20')
  })

  it('T2：epub:0 → epub:1 触发 attach，documentChanged 为 false', () => {
    let state = createTurnContextTrackerState()
    state = decideTurnContext(state, 'epub:/b.epub', 5, false, 'epub:0').next
    const moved = decideTurnContext(state, 'epub:/b.epub', 5, false, 'epub:1')
    expect(moved.attach).toBe(true)
    expect(moved.documentChanged).toBe(false)
  })

  it('T2：换文件仍 documentChanged，一次附加', () => {
    let state = createTurnContextTrackerState()
    state = decideTurnContext(state, 'pdf:/a.pdf', 5, false, 'pdf:19').next
    const switched = decideTurnContext(state, 'pdf:/b.pdf', 5, false, 'pdf:5')
    expect(switched.attach).toBe(true)
    expect(switched.documentChanged).toBe(true)
    expect(switched.next.lastLocationKey).toBe('pdf:5')
    expect(switched.next.lastDocumentKey).toBe('pdf:/b.pdf')
  })
})
