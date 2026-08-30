import { describe, expect, it } from 'vitest'
import {
  parsePermissionOptions,
  pickDefaultAllowOption,
  pickDefaultRejectOption,
  toolCallIdFromPermission,
} from './acp-permission'

describe('parsePermissionOptions', () => {
  it('accepts optionId and id', () => {
    const options = parsePermissionOptions([
      { optionId: 'allow-once', name: 'Allow', kind: 'allow_once' },
      { id: 'reject-once', title: 'Reject', kind: 'reject_once' },
    ])
    expect(options).toEqual([
      { optionId: 'allow-once', name: 'Allow', kind: 'allow_once' },
      { optionId: 'reject-once', name: 'Reject', kind: 'reject_once' },
    ])
  })

  it('picks default allow/reject', () => {
    const options = parsePermissionOptions([
      { optionId: 'reject-once', name: 'No', kind: 'reject_once' },
      { optionId: 'allow-once', name: 'Yes', kind: 'allow_once' },
    ])
    expect(pickDefaultAllowOption(options)?.optionId).toBe('allow-once')
    expect(pickDefaultRejectOption(options)?.optionId).toBe('reject-once')
  })
})

describe('toolCallIdFromPermission', () => {
  it('reads common id fields', () => {
    expect(toolCallIdFromPermission({ toolCallId: 'a' })).toBe('a')
    expect(toolCallIdFromPermission({ id: 'b' })).toBe('b')
    expect(toolCallIdFromPermission(undefined)).toBeUndefined()
  })
})
