// @vitest-environment happy-dom
import { describe, expect, it, afterEach } from 'vitest'
import {
  setupPdfTextLayerSelection,
  teardownPdfTextLayerSelectionRegistry,
} from './pdf-text-layer-selection'

describe('setupPdfTextLayerSelection', () => {
  afterEach(() => {
    teardownPdfTextLayerSelectionRegistry()
  })

  it('注入 endOfContent 并在 mousedown 时启用 selecting', () => {
    const layer = document.createElement('div')
    layer.className = 'textLayer'
    document.body.append(layer)

    const teardown = setupPdfTextLayerSelection(layer)
    const endOfContent = layer.querySelector('.endOfContent')
    expect(endOfContent).not.toBeNull()

    layer.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(layer.classList.contains('selecting')).toBe(true)

    teardown()
    layer.remove()
  })
})
