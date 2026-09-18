import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { CodexAuthPreflight } from '@inkdown/contracts'
import { hasValidAntigravityTokenFile } from './antigravity-bridge'

export function getAntigravityDir(): string {
  return join(homedir(), '.gemini', 'antigravity-acp')
}

export function getAntigravityDirCandidates(): string[] {
  const home = homedir()
  return [
    join(home, '.gemini', 'antigravity-acp'),
    join(home, '.gemini', 'antigravity'),
    join(home, '.gemini'),
  ]
}

export function getAntigravityConfiguredAuthType(): string | null {
  for (const dir of getAntigravityDirCandidates()) {
    const settingsPath = join(dir, 'settings.json')
    if (existsSync(settingsPath)) {
      try {
        const parsed = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
          auth?: { type?: string }
        }
        if (typeof parsed?.auth?.type === 'string' && parsed.auth.type.trim()) {
          return parsed.auth.type.trim()
        }
      } catch {
        // 忽略解析错误
      }
    }
  }
  return null
}

export function antigravityCredentialsPresent(): boolean {
  if (process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()) {
    return true
  }

  // 严格检查实际 Token 文件是否存在有效 refresh_token
  for (const dir of getAntigravityDirCandidates()) {
    const tokenPath = join(dir, 'acp_token.json')
    const businessTokenPath = join(dir, 'acp_business_token.json')
    if (hasValidAntigravityTokenFile(tokenPath) || existsSync(businessTokenPath)) {
      return true
    }
  }

  return false
}

export function probeAntigravityAuth(): CodexAuthPreflight {
  const dir = getAntigravityDir()
  const hasAuthFile = antigravityCredentialsPresent()
  const hasApiKeyEnv = Boolean(
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim(),
  )

  return {
    codexHome: dir,
    hasCodexHome: existsSync(dir),
    hasAuthFile,
    hasApiKeyEnv,
    looksLoggedIn: hasAuthFile || hasApiKeyEnv,
  }
}
