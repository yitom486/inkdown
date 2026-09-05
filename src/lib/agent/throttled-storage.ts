import type { StateStorage } from 'zustand/middleware'

/** 节流 persist 写入：高频 set() 合并为低频 localStorage 写入，dispose/flush 立即落盘。 */
export function createThrottledStorage(base: StateStorage, waitMs = 1500): StateStorage & {
  flush: () => void
  dispose: () => void
} {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: { name: string; value: string } | null = null

  const writeNow = () => {
    if (!pending) return
    const p = pending
    pending = null
    base.setItem(p.name, p.value)
  }

  return {
    getItem: (name) => base.getItem(name),
    setItem: (name, value) => {
      pending = { name, value }
      if (timer) return
      timer = setTimeout(() => {
        timer = null
        writeNow()
      }, waitMs)
    },
    removeItem: (name) => {
      pending = null
      base.removeItem(name)
    },
    flush: () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      writeNow()
    },
    dispose: () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      writeNow()
    },
  }
}
