// @vitest-environment happy-dom
import { describe, expect, it, afterEach } from 'vitest'
import {
  setupPdfTextLayerSelection,
  shouldSkipPdfEndOfContentHack,
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

  it('Chromium ≥148 / Firefox 跳过 endOfContent DOM hack', () => {
    const sample = document.createElement('div')
    document.body.append(sample)
    expect(shouldSkipPdfEndOfContentHack(sample, 'Mozilla/5.0 Chrome/148.0.0.0')).toBe(true)
    expect(shouldSkipPdfEndOfContentHack(sample, 'Mozilla/5.0 Chrome/120.0.0.0')).toBe(false)
    expect(
      shouldSkipPdfEndOfContentHack(sample, 'Mozilla/5.0', [{ brand: 'Chromium', version: '150' }]),
    ).toBe(true)
    sample.remove()
  })
})
