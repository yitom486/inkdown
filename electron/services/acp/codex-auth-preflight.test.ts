import { describe, expect, it } from 'vitest'
import { probeCodexAuth } from './codex-auth-preflight'

describe('probeCodexAuth', () => {
  it('returns boolean fields without throwing', () => {
    const result = probeCodexAuth()
    expect(result.codexHome.length).toBeGreaterThan(0)
    expect(typeof result.hasCodexHome).toBe('boolean')
    expect(typeof result.hasAuthFile).toBe('boolean')
    expect(typeof result.hasApiKeyEnv).toBe('boolean')
    expect(result.looksLoggedIn).toBe(result.hasAuthFile || result.hasApiKeyEnv)
  })
})
