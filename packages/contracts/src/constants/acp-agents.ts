import type { AcpRuntimeInfo } from '../types/acp'

/**
 * 默认 Codex ACP 适配器 npm 包。
 * 选型：`@agentclientprotocol/codex-acp`（官方 / Codex App Server）。
 * 勿用已归档的 `@zed-industries/codex-acp`（见计划「运行时包选型」）。
 */
export const CODEX_ACP_NPM_PACKAGE = '@agentclientprotocol/codex-acp' as const

/** 已弃用：仅作迁移对照 / 测试断言，禁止作为默认 spawn 目标 */
export const LEGACY_ZED_CODEX_ACP_NPM_PACKAGE = '@zed-industries/codex-acp' as const

export const DEFAULT_ACP_RUNTIME_ID = 'codex-acp'
export const ANTIGRAVITY_ACP_RUNTIME_ID = 'antigravity-acp'

/** 内置 Agent 运行时模板；不打包进安装程序，用户自备 bunx / 官方二进制 / Key */
export const BUILTIN_ACP_RUNTIMES: readonly AcpRuntimeInfo[] = [
  {
    id: 'codex-acp',
    name: 'Codex (codex-acp)',
    description:
      '通过 bunx 启动官方 @agentclientprotocol/codex-acp；可复用本机 ~/.codex（ChatGPT / API Key）',
    command: 'bunx',
    args: ['-y', CODEX_ACP_NPM_PACKAGE],
    requiredEnvKeys: ['OPENAI_API_KEY', 'CODEX_API_KEY'],
  },
  {
    id: ANTIGRAVITY_ACP_RUNTIME_ID,
    name: 'Google Antigravity',
    description:
      'Google 官方 Agent Client Protocol 服务端（Gemini 体系）；支持自动探测并复用本机 Google 账号授权',
    command: 'agy_acp_server',
    args: [],
    requiredEnvKeys: ['GEMINI_API_KEY'],
  },
] as const

export function findBuiltinAcpRuntime(id: string): AcpRuntimeInfo | undefined {
  return BUILTIN_ACP_RUNTIMES.find((item) => item.id === id)
}

