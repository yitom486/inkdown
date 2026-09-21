import { describe, expect, it } from 'vitest'
import { DEFAULT_ACP_RUNTIME_ID } from '@inkdown/contracts'
import { getAcpRuntimeAdapter } from './index'

describe('runtimes/index', () => {
  it('Antigravity 已淘汰：走未知运行时回落，不再派发专属适配器', () => {
    const adapter = getAcpRuntimeAdapter('antigravity-acp')
    expect(adapter.id).toBe('antigravity-acp')
    expect(adapter.probeAuth().looksLoggedIn).toBe(false)
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
