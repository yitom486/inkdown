import { describe, expect, it, vi } from 'vitest'
import { createThrottledStorage } from '@/lib/agent/throttled-storage'

describe('throttled-storage', () => {
  it('高频写入合并为一次底层写入，flush 立即落盘', () => {
    vi.useFakeTimers()
    try {
      const writes: string[] = []
      const base = {
        getItem: () => null,
        setItem: (_n: string, v: string) => {
          writes.push(v)
        },
        removeItem: () => {},
      }
      const s = createThrottledStorage(base, 1000)
      s.setItem('k', 'v1')
      s.setItem('k', 'v2')
      s.setItem('k', 'v3')
      expect(writes).toEqual([])
      s.flush()
      expect(writes).toEqual(['v3'])
      s.dispose()
    } finally {
      vi.useRealTimers()
    }
  })
})
