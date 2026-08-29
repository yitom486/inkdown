import { describe, expect, it } from 'vitest'
import {
  parseLoadSessionSupported,
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
})
