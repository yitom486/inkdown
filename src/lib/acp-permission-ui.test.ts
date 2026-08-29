import { describe, expect, it } from 'vitest'
import {
  shouldShowOrphanPermissionCard,
  toolMessageNeedsApproval,
} from './acp-permission-ui'
import type { AcpPendingPermission } from '@/stores/acp-ui-store'

const pending = (partial: Partial<AcpPendingPermission> = {}): AcpPendingPermission => ({
  requestId: 1,
  summary: '删除文件',
  options: [{ optionId: 'allow-once', name: '允许', kind: 'allow_once' }],
  toolCallId: 'tc-del',
  ...partial,
})

describe('toolMessageNeedsApproval', () => {
  it('matches pending toolCallId on tool messages', () => {
    expect(
      toolMessageNeedsApproval({ role: 'tool', toolCallId: 'tc-del' }, pending()),
    ).toBe(true)
    expect(
      toolMessageNeedsApproval({ role: 'tool', toolCallId: 'other' }, pending()),
    ).toBe(false)
    expect(
      toolMessageNeedsApproval({ role: 'agent', toolCallId: 'tc-del' }, pending()),
    ).toBe(false)
  })
})

describe('shouldShowOrphanPermissionCard', () => {
  it('shows when no toolCallId', () => {
    expect(
      shouldShowOrphanPermissionCard(pending({ toolCallId: undefined }), []),
    ).toBe(true)
  })

  it('shows when tool not yet in timeline', () => {
    expect(
      shouldShowOrphanPermissionCard(pending(), [
        { role: 'agent' },
        { role: 'tool', toolCallId: 'other' },
      ]),
    ).toBe(true)
  })

  it('hides when matching tool card exists (inline buttons instead)', () => {
    expect(
      shouldShowOrphanPermissionCard(pending(), [
        { role: 'tool', toolCallId: 'tc-del' },
      ]),
    ).toBe(false)
  })

  it('hides when no pending', () => {
    expect(shouldShowOrphanPermissionCard(null, [])).toBe(false)
  })
})
