import { describe, expect, it } from 'vitest'
import { orderSilentAuthMethodIds, shouldPromptAuthWizard } from './auth-method-order'

const methods = [
  { id: 'apikey', name: 'API Key', description: 'Use an API key', type: 'api_key' },
  { id: 'chatgpt', name: 'ChatGPT', description: 'Use ChatGPT', type: 'chatgpt' },
]

describe('orderSilentAuthMethodIds', () => {
  it('prefers ChatGPT when auth.json exists', () => {
    const ids = orderSilentAuthMethodIds(methods, {
      hasAuthFile: true,
      hasApiKeyEnv: false,
      looksLoggedIn: true,
    })
    expect(ids[0]).toBe('chatgpt')
    expect(ids[1]).toBe('apikey')
  })

  it('prefers API Key when only env key exists', () => {
    const ids = orderSilentAuthMethodIds(methods, {
      hasAuthFile: false,
      hasApiKeyEnv: true,
      looksLoggedIn: true,
    })
    expect(ids[0]).toBe('apikey')
  })
})

describe('shouldPromptAuthWizard', () => {
  it('prompts only when not logged in locally', () => {
    expect(shouldPromptAuthWizard(methods, { looksLoggedIn: false })).toBe(true)
    expect(shouldPromptAuthWizard(methods, { looksLoggedIn: true })).toBe(false)
    expect(shouldPromptAuthWizard([], { looksLoggedIn: false })).toBe(false)
  })
})
