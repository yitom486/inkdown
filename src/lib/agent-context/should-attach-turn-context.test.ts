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
})
