import { describe, expect, it } from 'vitest'
import { normalizeNewlines } from './text-normalize'

describe('normalizeNewlines', () => {
  it('converts CRLF to LF', () => {
    expect(normalizeNewlines('a\r\nb\r\nc')).toBe('a\nb\nc')
  })

  it('converts bare CR to LF', () => {
    expect(normalizeNewlines('a\rb\rc')).toBe('a\nb\nc')
  })

  it('leaves LF unchanged', () => {
    expect(normalizeNewlines('a\nb\nc')).toBe('a\nb\nc')
  })

  it('handles mixed endings', () => {
    expect(normalizeNewlines('a\r\nb\rc\nd')).toBe('a\nb\nc\nd')
  })
})
