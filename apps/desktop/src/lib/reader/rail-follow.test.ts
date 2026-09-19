// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { emitRailFollow, RAIL_FOLLOW_EVENT, subscribeRailFollow } from './rail-follow'

describe('rail-follow channel', () => {
  it('delivers finite fractions and ignores garbage', () => {
    const seen: number[] = []
    const off = subscribeRailFollow((f) => seen.push(f))
    emitRailFollow(0.25)
    emitRailFollow(Number.NaN)
    window.dispatchEvent(new CustomEvent(RAIL_FOLLOW_EVENT, { detail: 'x' }))
    expect(seen).toEqual([0.25])
    off()
    emitRailFollow(0.5)
    expect(seen).toEqual([0.25])
  })
})
