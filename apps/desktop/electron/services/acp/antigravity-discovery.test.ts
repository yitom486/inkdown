import { describe, expect, it } from 'vitest'
import {
  antigravityCredentialsPresent,
  findAntigravityServer,
  getAntigravityConfiguredAuthType,
  getAntigravityDir,
  probeAntigravityAuth,
} from './antigravity-discovery'

describe('antigravity-discovery', () => {
  it('locates local agy_acp_server if present on machine', () => {
    const server = findAntigravityServer()
    // 本机若有 Zed 或已安装，将返回 discovered 对象
    if (server) {
      expect(server.executablePath).toBeTruthy()
      expect(server.dir).toBeTruthy()
      expect(['env', 'zed_cache', 'app_cache', 'path']).toContain(server.source)
    }
  })

  it('probes antigravity credentials correctly', () => {
    const preflight = probeAntigravityAuth()
    expect(preflight.codexHome).toContain('antigravity-acp')
    expect(typeof preflight.hasAuthFile).toBe('boolean')
    expect(typeof preflight.looksLoggedIn).toBe('boolean')
  })

  it('reads configured auth.type from settings.json if present', () => {
    const authType = getAntigravityConfiguredAuthType()
    if (authType) {
      expect(['oauth-personal', 'oauth-business', 'gemini-api-key']).toContain(authType)
    }
  })

  it('respects custom AGY_ACP_SERVER_PATH override', () => {
    const current = findAntigravityServer()
    if (current) {
      const explicit = findAntigravityServer(current.executablePath)
      expect(explicit).toBeDefined()
      expect(explicit?.executablePath).toBe(current.executablePath)
      expect(explicit?.source).toBe('env')
    }
  })
})
