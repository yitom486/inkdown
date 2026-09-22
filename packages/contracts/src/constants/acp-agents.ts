import type { AcpRuntimeInfo } from '../types/acp'

/**
 * 默认 Codex ACP 适配器 npm 包。
 * 选型：`@agentclientprotocol/codex-acp`（官方 / Codex App Server）。
 * 勿用已归档的 `@zed-industries/codex-acp`（见计划「运行时包选型」）。
 */
export const CODEX_ACP_NPM_PACKAGE = '@agentclientprotocol/codex-acp' as const

/** Claude ACP 适配器 npm 包（官方 Agent Client Protocol 组织） */
export const CLAUDE_ACP_NPM_PACKAGE = '@agentclientprotocol/claude-agent-acp' as const

/** DeepSeek Harness ACP 服务 npm 包 */
export const DEEPSEEK_DSH_NPM_PACKAGE = '@deepseek-ai/dsh' as const

/** agy 桥 npm 包（Antigravity CLI → ACP） */
export const AGY_ACP_NPM_PACKAGE = '@yitom/agy-acp-map' as const

/** 已弃用：仅作迁移对照 / 测试断言，禁止作为默认 spawn 目标 */
export const LEGACY_ZED_CODEX_ACP_NPM_PACKAGE = '@zed-industries/codex-acp' as const

export const DEFAULT_ACP_RUNTIME_ID = 'codex-acp'

/**
 * 渲染进程安全：contracts 同时被 web（`tsconfig.web.json`，无 node 类型）
 * 与 main（`tsconfig.node.json`）编译，平台判断不碰裸 `process`，
 * 经 `globalThis` 取平台；取不到时按 posix 处理（spawn 只发生在主进程）。
 */
function isWindowsPlatform(): boolean {
  const proc = (globalThis as { process?: { platform?: string } }).process
  return proc?.platform === 'win32'
}

/** 内置 Agent 运行时模板；不打包进安装程序，用户自备 bunx / 官方二进制 / Key */
export const BUILTIN_ACP_RUNTIMES: readonly AcpRuntimeInfo[] = [
  {
    id: 'codex-acp',
    name: 'ChatGPT',
    description:
      '通过 bunx 启动官方 @agentclientprotocol/codex-acp；可复用本机 ~/.codex（ChatGPT / API Key）',
    authHint:
      '复用本机 ~/.codex 登录（auth.json 或 OPENAI_API_KEY / CODEX_API_KEY）；未登录按下方 Agent 认证方式完成登录',
    command: 'bunx',
    args: ['-y', `${CODEX_ACP_NPM_PACKAGE}@latest`],
    requiredEnvKeys: ['OPENAI_API_KEY', 'CODEX_API_KEY'],
  },
  {
    id: 'claude',
    name: 'Claude',
    description:
      '通过 bunx 启动官方 @agentclientprotocol/claude-agent-acp；可复用本机 Claude Code 登录态（~/.claude.json）或 ANTHROPIC_API_KEY',
    authHint:
      '复用本机 Claude Code 登录（~/.claude.json / ~/.claude/.credentials.json 或 ANTHROPIC_API_KEY）；未登录先跑 claude login',
    command: 'bunx',
    args: ['-y', CLAUDE_ACP_NPM_PACKAGE],
    requiredEnvKeys: ['ANTHROPIC_API_KEY'],
  },
  {
    id: 'gemini',
    name: 'Gemini',
    description: '启动本机 Gemini CLI（--acp）；复用 Gemini CLI 登录态（~/.gemini/）',
    authHint:
      '复用本机 Gemini CLI 登录（~/.gemini/oauth_creds.json 或 GEMINI_API_KEY / GOOGLE_API_KEY）；未登录先在本机终端跑 gemini 完成登录',
    command: isWindowsPlatform() ? 'gemini.cmd' : 'gemini',
    args: ['--acp'],
    requiredEnvKeys: [],
  },
  {
    id: 'copilot',
    name: 'Copilot',
    description: '启动本机 Copilot CLI（--acp --stdio）；复用 Copilot CLI 的 GitHub 登录态',
    authHint:
      '复用本机 Copilot CLI 的 GitHub 登录（~/.copilot/config.json 或 COPILOT_GITHUB_TOKEN / GH_TOKEN / GITHUB_TOKEN）；未登录先跑 copilot login',
    command: isWindowsPlatform() ? 'copilot.cmd' : 'copilot',
    args: ['--acp', '--stdio'],
    requiredEnvKeys: [],
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    description:
      '启动本机 opencode（acp）；复用 `opencode auth login` 写入 auth.json（~/.local/share/opencode/auth.json）的各 provider 凭证',
    authHint:
      '已登录（%LOCALAPPDATA%\\opencode\\auth.json 或 ~/.local/share/opencode/auth.json）则直接连接；否则先跑 opencode auth login',
    command: isWindowsPlatform() ? 'opencode.exe' : 'opencode',
    args: ['acp'],
    requiredEnvKeys: [],
  },
  {
    id: 'cursor-cli',
    name: 'Cursor',
    description:
      '启动 Cursor 官方 CLI（agent acp）；复用本机 Cursor 登录态（未登录可运行 `agent login`）。安装路径探测（%LOCALAPPDATA%\\cursor-agent / ~/.local/bin/agent）见主进程 cursor 适配器',
    authHint:
      '复用本机 Cursor 登录态（或 CURSOR_API_KEY / CURSOR_AUTH_TOKEN）；未登录先跑 agent login',
    command: isWindowsPlatform() ? 'agent.cmd' : 'agent',
    args: ['acp'],
    requiredEnvKeys: [],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description:
      '通过 bunx 启动 @deepseek-ai/dsh（--profile acp）；无 ACP 登录，靠 harness 自身凭证（DEEPSEEK_API_KEY / harness 配置）；模型经 session 到达，无需额外动作',
    authHint:
      '无 ACP 登录，靠 harness 自身凭证（DEEPSEEK_API_KEY / harness 配置）；未配置先导出 DEEPSEEK_API_KEY；模型经 session 到达，无需额外动作；若官方最新 dsh 存在坏依赖（如 rc.3 缺失），可设 DSH_PACKAGE pin 旧版',
    command: 'bunx',
    args: ['-y', `${DEEPSEEK_DSH_NPM_PACKAGE}@latest`, '--profile', 'acp'],
    requiredEnvKeys: ['DEEPSEEK_API_KEY'],
  },
  {
    id: 'agy',
    name: 'agy',
    description:
      '经 bunx 直调官方桥 JS 入口（免安装，跨平台；版本跟随 bunx 解析）',
    authHint: '复用 Antigravity CLI 本地登录态；未登录先在本机终端完成 agy 登录后再连接',
    command: 'bunx',
    // @latest 后缀：bunx 对裸包名只按 24h 新鲜度复用缓存，显式 @latest 才每次直取 registry 最新
    args: ['-y', `${AGY_ACP_NPM_PACKAGE}@latest`],
    requiredEnvKeys: [],
  },
] as const

export function findBuiltinAcpRuntime(id: string): AcpRuntimeInfo | undefined {
  return BUILTIN_ACP_RUNTIMES.find((item) => item.id === id)
}

