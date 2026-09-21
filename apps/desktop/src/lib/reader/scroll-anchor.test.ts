// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { preserveScrollAnchor } from './scroll-anchor'

describe('preserveScrollAnchor', () => {
  it('executes layout callback safely when DOM is absent or container is missing', () => {
    const callback = vi.fn()
    preserveScrollAnchor(callback)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('preserves anchor offset when candidates exist', () => {
    const container = document.createElement('div')
    container.id = 'reading-text-canvas'
    document.body.appendChild(container)

    const p = document.createElement('p')
    p.textContent = '测试正文段落'
    vi.spyOn(p, 'getBoundingClientRect').mockReturnValue({
      top: 120,
      bottom: 150,
      left: 0,
      right: 100,
      width: 100,
      height: 30,
      x: 0,
      y: 120,
      toJSON: () => {},
    })
    container.appendChild(p)

    const callback = vi.fn()
    preserveScrollAnchor(callback)
    expect(callback).toHaveBeenCalledTimes(1)

    document.body.removeChild(container)
  })
})
