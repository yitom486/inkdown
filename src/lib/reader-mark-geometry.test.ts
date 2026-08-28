import { describe, expect, it } from 'vitest'
import { buildMobiMarkStylesCss } from './reader-mark-geometry'

describe('buildMobiMarkStylesCss', () => {
  it('批注 span 使用 text-decoration 下划线，避免 border 遮挡文字', () => {
    const css = buildMobiMarkStylesCss('light')
    expect(css).toContain('span.mobi-mark-note')
    expect(css).toContain('text-decoration-line: underline')
    expect(css).toContain('text-underline-offset')
    expect(css).toContain('border-bottom: none')
  })

  it('rect 回退批注使用独立 hit 区与 ::after 下划线', () => {
    const css = buildMobiMarkStylesCss('dark')
    expect(css).toContain('.mobi-mark-note-hit')
    expect(css).toContain('.mobi-mark-note-hit::after')
    expect(css).toContain('border-bottom: 2px dashed')
  })
})
