import { describe, expect, it } from 'vitest'
import { decideConnectAuth } from './connect-auth-decision'

const methods = [
  { id: 'apikey', name: 'API Key', type: 'api_key' },
  { id: 'chatgpt', name: 'ChatGPT', type: 'chatgpt' },
]

describe('decideConnectAuth', () => {
  it('skips when agent has no auth methods', () => {
    expect(
      decideConnectAuth([], { looksLoggedIn: false, hasAuthFile: false, hasApiKeyEnv: false }),
    ).toEqual({ action: 'skip_auth' })
  })

  it('opens wizard when not logged in locally', () => {
    const decision = decideConnectAuth(methods, {
      looksLoggedIn: false,
      hasAuthFile: false,
      hasApiKeyEnv: false,
    })
    expect(decision.action).toBe('needs_auth')
    if (decision.action === 'needs_auth') {
      expect(decision.methods.map((m) => m.id)).toContain('chatgpt')
      expect(decision.methods.map((m) => m.id)).toContain('apikey')
    }
  })

  it('silently prefers chatgpt when auth.json exists', () => {
    const decision = decideConnectAuth(methods, {
      looksLoggedIn: true,
      hasAuthFile: true,
      hasApiKeyEnv: false,
    })
    expect(decision).toEqual({
      action: 'silent',
      methodIds: ['chatgpt', 'apikey'],
    })
  })

  it('silently prefers api key when only env key exists', () => {
    const decision = decideConnectAuth(methods, {
      looksLoggedIn: true,
      hasAuthFile: false,
      hasApiKeyEnv: true,
    })
    expect(decision.action).toBe('silent')
    if (decision.action === 'silent') {
      expect(decision.methodIds[0]).toBe('apikey')
    }
  })
})
