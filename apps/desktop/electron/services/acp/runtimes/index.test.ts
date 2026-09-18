import { describe, expect, it } from 'vitest'
import { ANTIGRAVITY_ACP_RUNTIME_ID, DEFAULT_ACP_RUNTIME_ID } from '@inkdown/contracts'
import { getAcpRuntimeAdapter } from './index'

describe('runtimes/index', () => {
  it('正确派发 Antigravity 适配器', () => {
    const adapter = getAcpRuntimeAdapter(ANTIGRAVITY_ACP_RUNTIME_ID)
    expect(adapter.id).toBe(ANTIGRAVITY_ACP_RUNTIME_ID)
    expect(typeof adapter.beforeSpawn).toBe('function')
    expect(typeof adapter.getSpawnEnv).toBe('function')
    expect(typeof adapter.canSkipInteractiveAuth).toBe('function')
  })

  it('正确派发 Codex 适配器', () => {
    const adapter = getAcpRuntimeAdapter(DEFAULT_ACP_RUNTIME_ID)
    expect(adapter.id).toBe(DEFAULT_ACP_RUNTIME_ID)
    expect(typeof adapter.probeAuth).toBe('function')
    expect(typeof adapter.getCustomProvider).toBe('function')
  })

  it('未知运行时回落通用空中性探测', () => {
    const adapter = getAcpRuntimeAdapter('unknown-runtime')
    expect(adapter.id).toBe('unknown-runtime')
    expect(adapter.probeAuth().looksLoggedIn).toBe(false)
  })
})
