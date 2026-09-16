import { describe, expect, it } from 'vitest'
import {
  BUILTIN_ACP_RUNTIMES,
  CODEX_ACP_NPM_PACKAGE,
  DEFAULT_ACP_RUNTIME_ID,
  findBuiltinAcpRuntime,
  LEGACY_ZED_CODEX_ACP_NPM_PACKAGE,
} from './acp-agents'

describe('BUILTIN_ACP_RUNTIMES package selection', () => {
  it('defaults to official @agentclientprotocol/codex-acp', () => {
    expect(CODEX_ACP_NPM_PACKAGE).toBe('@agentclientprotocol/codex-acp')
    expect(DEFAULT_ACP_RUNTIME_ID).toBe('codex-acp')

    const runtime = findBuiltinAcpRuntime(DEFAULT_ACP_RUNTIME_ID)
    expect(runtime).toBeDefined()
    expect(runtime!.command).toBe('bunx')
    expect(runtime!.args).toEqual(['-y', CODEX_ACP_NPM_PACKAGE])
  })

  it('does not spawn archived @zed-industries/codex-acp', () => {
    for (const runtime of BUILTIN_ACP_RUNTIMES) {
      expect(runtime.args.join(' ')).not.toContain(LEGACY_ZED_CODEX_ACP_NPM_PACKAGE)
    }
  })
})
