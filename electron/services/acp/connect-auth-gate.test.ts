import { describe, expect, it, vi } from 'vitest'
import { runConnectAuthGate } from './connect-auth-gate'

/** 模拟 Agent initialize 返回的 authMethods（API Key 排在第一，复现误弹窗根因） */
const mockAgentAuthMethods = [
  { id: 'apikey', name: 'API Key', type: 'api_key' },
  { id: 'chatgpt', name: 'ChatGPT', type: 'chatgpt' },
]

describe('runConnectAuthGate (E2E scenarios with mock Agent)', () => {
  it('no auth.json / no env key → opens wizard, does not call authenticate', async () => {
    const authenticate = vi.fn()
    const result = await runConnectAuthGate(
      mockAgentAuthMethods,
      { looksLoggedIn: false, hasAuthFile: false, hasApiKeyEnv: false },
      { authenticate },
    )

    expect(authenticate).not.toHaveBeenCalled()
    expect(result).toMatchObject({ outcome: 'needs_auth' })
    if (result.outcome === 'needs_auth') {
      expect(result.methods.map((m) => m.id)).toEqual(expect.arrayContaining(['chatgpt', 'apikey']))
    }
  })

  it('auth.json present → silent ChatGPT first (not first list item API Key)', async () => {
    const authenticate = vi.fn().mockResolvedValue(undefined)
    const result = await runConnectAuthGate(
      mockAgentAuthMethods,
      { looksLoggedIn: true, hasAuthFile: true, hasApiKeyEnv: false },
      { authenticate },
    )

    expect(result).toEqual({ outcome: 'authenticated', methodId: 'chatgpt' })
    expect(authenticate).toHaveBeenCalledTimes(1)
    expect(authenticate).toHaveBeenCalledWith('chatgpt')
  })

  it('auth.json present but ChatGPT fails → falls back to API Key', async () => {
    const authenticate = vi.fn().mockImplementation(async (methodId: string) => {
      if (methodId === 'chatgpt') throw new Error('oauth unavailable')
    })
    const result = await runConnectAuthGate(
      mockAgentAuthMethods,
      { looksLoggedIn: true, hasAuthFile: true, hasApiKeyEnv: false },
      { authenticate },
    )

    expect(result).toEqual({ outcome: 'authenticated', methodId: 'apikey' })
    expect(authenticate.mock.calls.map((c) => c[0])).toEqual(['chatgpt', 'apikey'])
  })

  it('auth.json present but all silent auth fail → try session then wizard', async () => {
    const authenticate = vi.fn().mockRejectedValue(new Error('auth failed'))
    const tryOpen = vi.fn().mockResolvedValue(false)
    const result = await runConnectAuthGate(
      mockAgentAuthMethods,
      { looksLoggedIn: true, hasAuthFile: true, hasApiKeyEnv: false },
      { authenticate, tryOpenSessionWithoutAuth: tryOpen },
    )

    expect(tryOpen).toHaveBeenCalled()
    expect(result.outcome).toBe('needs_auth')
  })

  it('auth.json present, silent auth fail, but session/new works → no wizard', async () => {
    const authenticate = vi.fn().mockRejectedValue(new Error('auth failed'))
    const result = await runConnectAuthGate(
      mockAgentAuthMethods,
      { looksLoggedIn: true, hasAuthFile: true, hasApiKeyEnv: false },
      {
        authenticate,
        tryOpenSessionWithoutAuth: async () => true,
      },
    )

    expect(result).toEqual({ outcome: 'session_without_auth' })
  })

  it('only env API key → silent API Key first', async () => {
    const authenticate = vi.fn().mockResolvedValue(undefined)
    const result = await runConnectAuthGate(
      mockAgentAuthMethods,
      { looksLoggedIn: true, hasAuthFile: false, hasApiKeyEnv: true },
      { authenticate },
    )

    expect(result).toEqual({ outcome: 'authenticated', methodId: 'apikey' })
    expect(authenticate).toHaveBeenCalledWith('apikey')
  })

  it('Agent returns no authMethods → skip auth', async () => {
    const authenticate = vi.fn()
    const result = await runConnectAuthGate(
      [],
      { looksLoggedIn: false, hasAuthFile: false, hasApiKeyEnv: false },
      { authenticate },
    )
    expect(result).toEqual({ outcome: 'skip_auth' })
    expect(authenticate).not.toHaveBeenCalled()
  })
})
