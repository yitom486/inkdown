import { describe, expect, it } from 'vitest'
import {
  parseLoadSessionSupported,
  parsePromptCapabilities,
  parseResumeSessionSupported,
} from './session-capabilities'

describe('session capabilities', () => {
  it('parses loadSession', () => {
    expect(parseLoadSessionSupported({ loadSession: true })).toBe(true)
    expect(parseLoadSessionSupported({})).toBe(false)
  })

  it('parses resume as true or empty object (codex-acp)', () => {
    expect(
      parseResumeSessionSupported({
        sessionCapabilities: { resume: {} },
      }),
    ).toBe(true)
    expect(
      parseResumeSessionSupported({
        sessionCapabilities: { resume: true },
      }),
    ).toBe(true)
    expect(parseResumeSessionSupported({ sessionCapabilities: {} })).toBe(false)
    expect(parseResumeSessionSupported({})).toBe(false)
  })

  it('parses promptCapabilities.image', () => {
    expect(parsePromptCapabilities({ promptCapabilities: { image: true } }).image).toBe(true)
    expect(parsePromptCapabilities({ promptCapabilities: {} }).image).toBe(false)
    expect(parsePromptCapabilities({}).image).toBeUndefined()
  })
})
