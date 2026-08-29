import type { AcpRuntimeInfo } from '@shared/types/acp'

/** 内置 Agent 运行时模板；不打包进安装程序，用户自备 bunx / Key */
export const BUILTIN_ACP_RUNTIMES: readonly AcpRuntimeInfo[] = [
  {
    id: 'codex-acp',
    name: 'Codex (codex-acp)',
    description: '通过 bunx 启动 @agentclientprotocol/codex-acp；需 OPENAI_API_KEY 或 CODEX_API_KEY',
    command: 'bunx',
    args: ['-y', '@agentclientprotocol/codex-acp'],
    requiredEnvKeys: ['OPENAI_API_KEY', 'CODEX_API_KEY'],
  },
] as const

export const DEFAULT_ACP_RUNTIME_ID = 'codex-acp'

export function findBuiltinAcpRuntime(id: string): AcpRuntimeInfo | undefined {
  return BUILTIN_ACP_RUNTIMES.find((item) => item.id === id)
}
