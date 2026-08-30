import { describe, expect, it } from 'vitest'
import { formatAcpConnectedMessage } from './acp-session-restore'

describe('formatAcpConnectedMessage', () => {
  it('shows restore success', () => {
    expect(
      formatAcpConnectedMessage(
        {
          phase: 'ready',
          runtimeId: 'codex-acp',
          sessionId: 'sess-1',
          protocolVersion: 1,
          sessionRestored: true,
          restoreMethod: 'resume',
        },
        '已连接',
      ),
    ).toContain('已恢复会话 sess-1（resume）')
  })

  it('shows explicit fallback after failed resume/load', () => {
    const msg = formatAcpConnectedMessage(
      {
        phase: 'ready',
        runtimeId: 'codex-acp',
        sessionId: 'sess-new',
        protocolVersion: 1,
        sessionRestored: false,
        restoreMethod: 'new',
        requestedSessionId: '01a04ca7-8119-7720-a474-9df22482abcf',
        restoreAttempts: [
          { method: 'resume', ok: false, tries: 2, error: '传输已销毁' },
          { method: 'load', ok: false, tries: 1, error: 'not found' },
        ],
      },
      '已连接',
    )
    expect(msg).toContain('恢复 01a04ca7… 失败')
    expect(msg).toContain('resume×2失败：传输已销毁')
    expect(msg).toContain('已新建会话 sess-new')
  })
})
