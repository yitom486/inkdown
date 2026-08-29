import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface CodexAuthPreflight {
  /** CODEX_HOME 或默认 ~/.codex */
  codexHome: string
  /** 目录是否存在 */
  hasCodexHome: boolean
  /** auth.json 是否存在（不读内容） */
  hasAuthFile: boolean
  /** 进程环境是否已有 API Key（不回传值） */
  hasApiKeyEnv: boolean
  /** 粗判：像已登录，可直接尝试连接 */
  looksLoggedIn: boolean
}

function resolveCodexHome(): string {
  const fromEnv = process.env.CODEX_HOME?.trim()
  if (fromEnv) return fromEnv
  return join(homedir(), '.codex')
}

/**
 * 仅做布尔级探测，对齐 VS Code/Zed「复用本机 Codex 登录」：
 * 不把 auth.json / token 读进渲染进程。
 */
export function probeCodexAuth(): CodexAuthPreflight {
  const codexHome = resolveCodexHome()
  const hasCodexHome = existsSync(codexHome)
  const hasAuthFile = existsSync(join(codexHome, 'auth.json'))
  const hasApiKeyEnv = Boolean(
    process.env.CODEX_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim(),
  )

  return {
    codexHome,
    hasCodexHome,
    hasAuthFile,
    hasApiKeyEnv,
    looksLoggedIn: hasAuthFile || hasApiKeyEnv,
  }
}
