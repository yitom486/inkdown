import { describe, expect, it, vi } from 'vitest'
import { stopPendingEpubRenditionWork } from '@/lib/reader/epub-rendition-lifecycle'

describe('stopPendingEpubRenditionWork', () => {
  it('stops the queued rendition startup before Book.destroy clears its book reference', () => {
    const stop = vi.fn()
    const clear = vi.fn()

    stopPendingEpubRenditionWork({ q: { stop, clear } })

    expect(stop).toHaveBeenCalledOnce()
    expect(clear).not.toHaveBeenCalled()
  })

  it('uses clear as a compatibility fallback when a queue has no stop method', () => {
    const clear = vi.fn()

    stopPendingEpubRenditionWork({ q: { clear } })

    expect(clear).toHaveBeenCalledOnce()
  })

  it('is safe for an absent rendition', () => {
    expect(() => stopPendingEpubRenditionWork(null)).not.toThrow()
  })
})
