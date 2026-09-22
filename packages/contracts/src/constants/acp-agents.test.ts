import { describe, expect, it } from 'vitest'
import {
  AGY_ACP_NPM_PACKAGE,
  BUILTIN_ACP_RUNTIMES,
  CLAUDE_ACP_NPM_PACKAGE,
  CODEX_ACP_NPM_PACKAGE,
  DEEPSEEK_DSH_NPM_PACKAGE,
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

  it('Antigravity 已淘汰：模板中无 antigravity-acp', () => {
    expect(findBuiltinAcpRuntime('antigravity-acp')).toBeUndefined()
    expect(
      BUILTIN_ACP_RUNTIMES.some((runtime) => runtime.command === 'agy_acp_server'),
    ).toBe(false)
  })

  it('内置 8 运行时模板（codex + 6 新增 + agy）', () => {
    expect(BUILTIN_ACP_RUNTIMES.map((runtime) => runtime.id)).toEqual([
      'codex-acp',
      'claude',
      'gemini',
      'copilot',
      'opencode',
      'cursor-cli',
      'deepseek',
      'agy',
    ])
  })

  it('claude 经 bunx 启动官方 claude-agent-acp', () => {
    expect(CLAUDE_ACP_NPM_PACKAGE).toBe('@agentclientprotocol/claude-agent-acp')
    const runtime = findBuiltinAcpRuntime('claude')
    expect(runtime).toBeDefined()
    expect(runtime!.command).toBe('bunx')
    expect(runtime!.args).toEqual(['-y', CLAUDE_ACP_NPM_PACKAGE])
    expect(runtime!.requiredEnvKeys).toContain('ANTHROPIC_API_KEY')
    expect(runtime!.description).toContain('ANTHROPIC_API_KEY')
  })

  it('gemini 用本机 Gemini CLI --acp', () => {
    const runtime = findBuiltinAcpRuntime('gemini')
    expect(runtime).toBeDefined()
    expect(runtime!.args).toEqual(['--acp'])
    expect(runtime!.description).toContain('Gemini CLI')
  })

  it('copilot 用本机 Copilot CLI --acp --stdio', () => {
    const runtime = findBuiltinAcpRuntime('copilot')
    expect(runtime).toBeDefined()
    expect(runtime!.args).toEqual(['--acp', '--stdio'])
    expect(runtime!.description).toContain('GitHub')
  })

  it('opencode 用本机 opencode acp，凭证走 auth.json', () => {
    const runtime = findBuiltinAcpRuntime('opencode')
    expect(runtime).toBeDefined()
    expect(runtime!.args).toEqual(['acp'])
    expect(runtime!.description).toContain('auth.json')
  })

  it('cursor-cli 用 agent acp，未登录指引 agent login', () => {
    const runtime = findBuiltinAcpRuntime('cursor-cli')
    expect(runtime).toBeDefined()
    expect(runtime!.args).toEqual(['acp'])
    expect(runtime!.description).toContain('agent login')
  })

  it('deepseek 经 bunx 启动 dsh --profile acp', () => {
    expect(DEEPSEEK_DSH_NPM_PACKAGE).toBe('@deepseek-ai/dsh')
    const runtime = findBuiltinAcpRuntime('deepseek')
    expect(runtime).toBeDefined()
    expect(runtime!.command).toBe('bunx')
    expect(runtime!.args).toEqual(['-y', DEEPSEEK_DSH_NPM_PACKAGE, '--profile', 'acp'])
    expect(runtime!.requiredEnvKeys).toContain('DEEPSEEK_API_KEY')
  })

  it('用户可见显示名去技术化（不暴露 acp 名词）', () => {
    expect(findBuiltinAcpRuntime('codex-acp')!.name).toBe('ChatGPT')
    expect(findBuiltinAcpRuntime('claude')!.name).toBe('Claude')
    expect(findBuiltinAcpRuntime('gemini')!.name).toBe('Gemini')
    expect(findBuiltinAcpRuntime('copilot')!.name).toBe('Copilot')
    expect(findBuiltinAcpRuntime('opencode')!.name).toBe('OpenCode')
    expect(findBuiltinAcpRuntime('cursor-cli')!.name).toBe('Cursor')
    expect(findBuiltinAcpRuntime('deepseek')!.name).toBe('DeepSeek')
    expect(findBuiltinAcpRuntime('agy')!.name).toBe('agy')
    for (const runtime of BUILTIN_ACP_RUNTIMES) {
      expect(runtime.name).not.toMatch(/acp/i)
      expect(runtime.name).not.toContain('cursor-agent')
      expect(runtime.name).not.toContain('claude-agent-acp')
    }
  })

  it('8 项均有认证弹窗用 authHint（凭证位置 + 未登录一步动作）', () => {
    expect(BUILTIN_ACP_RUNTIMES).toHaveLength(8)
    for (const runtime of BUILTIN_ACP_RUNTIMES) {
      expect(runtime.authHint, runtime.id).toBeDefined()
      expect(typeof runtime.authHint).toBe('string')
      expect(runtime.authHint!.length).toBeGreaterThan(0)
    }
    expect(findBuiltinAcpRuntime('codex-acp')!.authHint).toContain('~/.codex')
    expect(findBuiltinAcpRuntime('opencode')!.authHint).toContain('opencode auth login')
    expect(findBuiltinAcpRuntime('cursor-cli')!.authHint).toContain('agent login')
  })

  it('agy 经 bunx 直调官方桥 JS 入口（免安装，跨平台）', () => {
    expect(AGY_ACP_NPM_PACKAGE).toBe('@yitom/agy-acp-map')
    const runtime = findBuiltinAcpRuntime('agy')
    expect(runtime).toBeDefined()
    expect(runtime!.command).toBe('bunx')
    expect(runtime!.args).toEqual(['-y', AGY_ACP_NPM_PACKAGE])
    expect(runtime!.description).toContain('bunx')
    expect(runtime!.authHint).toContain('Antigravity CLI')
  })

  it('deepseek 模型经 session 到达、无需额外动作', () => {
    const runtime = findBuiltinAcpRuntime('deepseek')
    expect(runtime!.description).toContain('模型经 session 到达')
    expect(runtime!.authHint).toContain('模型经 session 到达')
  })
})

