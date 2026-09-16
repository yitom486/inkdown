import { describe, expect, it, vi } from 'vitest'
import {
  isTransientAcpTransportError,
  restoreOrCreateAcpSession,
} from './session-open'

describe('isTransientAcpTransportError', () => {
  it('matches known transport failures', () => {
    expect(isTransientAcpTransportError('传输已销毁')).toBe(true)
    expect(isTransientAcpTransportError('请求超时: session/resume')).toBe(true)
    expect(isTransientAcpTransportError('session not found')).toBe(false)
  })
})

describe('restoreOrCreateAcpSession', () => {
  it('prefers session/resume when supported', async () => {
    const request = vi.fn(async (method: string) => {
      if (method === 'session/resume') {
        return { sessionId: 'old-1', configOptions: [] }
      }
      throw new Error(`unexpected ${method}`)
    })

    const result = await restoreOrCreateAcpSession({
      request,
      cwd: '/ws',
      resumeSessionId: 'old-1',
      resumeSupported: true,
      loadSupported: true,
      retryDelayMs: 0,
      log: () => undefined,
    })

    expect(result.restoreMethod).toBe('resume')
    expect(result.sessionRestored).toBe(true)
    expect(result.sessionId).toBe('old-1')
    expect(request).toHaveBeenCalledWith(
      'session/resume',
      expect.objectContaining({ sessionId: 'old-1' }),
    )
    expect(request).not.toHaveBeenCalledWith('session/new', expect.anything())
  })

  it('retries resume on 传输已销毁 then falls back to load', async () => {
    let resumeTries = 0
    const request = vi.fn(async (method: string) => {
      if (method === 'session/resume') {
        resumeTries += 1
        throw new Error('传输已销毁')
      }
      if (method === 'session/load') {
        return { sessionId: 'old-1', configOptions: [{ configId: 'm' }] }
      }
      throw new Error(`unexpected ${method}`)
    })

    const suppress: boolean[] = []
    const result = await restoreOrCreateAcpSession({
      request,
      cwd: '/ws',
      resumeSessionId: 'old-1',
      resumeSupported: true,
      loadSupported: true,
      retryDelayMs: 0,
      onSuppressUpdates: (v) => suppress.push(v),
      log: () => undefined,
    })

    expect(resumeTries).toBe(2)
    expect(result.restoreMethod).toBe('load')
    expect(result.sessionRestored).toBe(true)
    expect(result.restoreAttempts).toEqual([
      { method: 'resume', ok: false, tries: 2, error: '传输已销毁' },
      { method: 'load', ok: true, tries: 1 },
    ])
    expect(suppress).toEqual([true, false])
  })

  it('falls back to session/new with failed attempts recorded', async () => {
    const request = vi.fn(async (method: string) => {
      if (method === 'session/resume') throw new Error('gone')
      if (method === 'session/load') throw new Error('missing')
      if (method === 'session/new') return { sessionId: 'brand-new' }
      throw new Error(`unexpected ${method}`)
    })

    const result = await restoreOrCreateAcpSession({
      request,
      cwd: '/ws',
      resumeSessionId: '01a04ca7-dead',
      resumeSupported: true,
      loadSupported: true,
      retryDelayMs: 0,
      log: () => undefined,
    })

    expect(result.restoreMethod).toBe('new')
    expect(result.sessionRestored).toBe(false)
    expect(result.sessionId).toBe('brand-new')
    expect(result.requestedSessionId).toBe('01a04ca7-dead')
    expect(result.restoreAttempts.every((a) => !a.ok)).toBe(true)
  })

  it('skips restore and creates new when no resume id', async () => {
    const request = vi.fn(async (method: string) => {
      if (method === 'session/new') return { sessionId: 'n1' }
      throw new Error(`unexpected ${method}`)
    })

    const result = await restoreOrCreateAcpSession({
      request,
      cwd: '/ws',
      resumeSessionId: null,
      resumeSupported: true,
      loadSupported: true,
      retryDelayMs: 0,
      log: () => undefined,
    })

    expect(result).toMatchObject({
      sessionId: 'n1',
      restoreMethod: 'new',
      sessionRestored: false,
    })
    expect(request).toHaveBeenCalledTimes(1)
  })
})
