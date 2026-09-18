import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ANTIGRAVITY_CLIENT_ID,
  ANTIGRAVITY_CLIENT_SECRET,
  bridgeAntigravityCredentialFromManager,
  hasValidAntigravityTokenFile,
} from './antigravity-bridge'

let tempDir: string

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'inkdown-bridge-test-'))
})

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

describe('antigravity-bridge', () => {
  it('hasValidAntigravityTokenFile 准确判断有效性', async () => {
    const filePath = join(tempDir, 'acp_token.json')
    expect(hasValidAntigravityTokenFile(filePath)).toBe(false)

    await writeFile(filePath, '{ "broken": true }', 'utf8')
    expect(hasValidAntigravityTokenFile(filePath)).toBe(false)

    await writeFile(
      filePath,
      JSON.stringify({ refresh_token: 'valid_refresh_token_123' }),
      'utf8',
    )
    expect(hasValidAntigravityTokenFile(filePath)).toBe(true)
  })

  it('文件已存在合法 token 时直接复用跳过，不调用 exec', async () => {
    const filePath = join(tempDir, 'acp_token.json')
    await writeFile(
      filePath,
      JSON.stringify({ refresh_token: 'existing_token' }),
      'utf8',
    )

    let called = false
    const ok = await bridgeAntigravityCredentialFromManager({
      targetFile: filePath,
      execCommand: async () => {
        called = true
        return { stdout: '' }
      },
    })

    expect(ok).toBe(true)
    expect(called).toBe(false)
  })

  it('从凭据管理器模拟读取并以官方格式写入 acp_token.json', async () => {
    const filePath = join(tempDir, 'acp_token.json')
    const mockOutput = JSON.stringify({
      auth_method: 'oauth-personal',
      token: {
        access_token: 'temp_access_token',
        refresh_token: '1//0gRealRefreshTokenFromWindowsManager',
      },
    })

    const ok = await bridgeAntigravityCredentialFromManager({
      targetFile: filePath,
      execCommand: async () => {
        return { stdout: mockOutput }
      },
    })

    expect(ok).toBe(true)
    const content = JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>
    expect(content.client_id).toBe(ANTIGRAVITY_CLIENT_ID)
    expect(content.client_secret).toBe(ANTIGRAVITY_CLIENT_SECRET)
    expect(content.refresh_token).toBe('1//0gRealRefreshTokenFromWindowsManager')
    expect(content.token_uri).toBe('https://oauth2.googleapis.com/token')
    expect(Array.isArray(content.scopes)).toBe(true)
  })

  it('提取失败或无 refresh_token 时安全返回 false', async () => {
    const filePath = join(tempDir, 'acp_token.json')
    const ok = await bridgeAntigravityCredentialFromManager({
      targetFile: filePath,
      execCommand: async () => {
        return { stdout: JSON.stringify({ token: {} }) }
      },
    })

    expect(ok).toBe(false)
  })
})
