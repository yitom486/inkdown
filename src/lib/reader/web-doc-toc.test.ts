// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import {
  findWebDocFlatIndex,
  normalizeWebDocNavUrl,
  syncWebNavigation,
  webDocTocEntriesToReaderUnits,
} from './web-doc-toc'

describe('web-doc-toc', () => {
  const units = webDocTocEntriesToReaderUnits([
    { href: 'https://react.dev/learn', label: 'Quick Start', level: 0 },
    { href: 'https://react.dev/learn/installation', label: 'Installation', level: 0 },
  ])

  it('规范化 URL 用于匹配', () => {
    expect(normalizeWebDocNavUrl('https://react.dev/learn/#setup')).toBe('https://react.dev/learn')
    expect(normalizeWebDocNavUrl('https://react.dev/learn/')).toBe('https://react.dev/learn')
  })

  it('按 URL 定位 flatIndex', () => {
    expect(findWebDocFlatIndex(units, 'https://react.dev/learn/installation/')).toBe(1)
  })

  it('分组与首链同 href 时优先更深叶子', () => {
    const nested = webDocTocEntriesToReaderUnits([
      { href: 'https://agentclientprotocol.com/protocol/v1/overview', label: 'Protocol', level: 0 },
      { href: 'https://agentclientprotocol.com/protocol/v1/overview', label: 'v1', level: 1 },
      { href: 'https://agentclientprotocol.com/protocol/v1/overview', label: 'Overview', level: 2 },
      {
        href: 'https://agentclientprotocol.com/protocol/v1/initialization',
        label: 'Initialization',
        level: 2,
      },
    ])
    const index = findWebDocFlatIndex(
      nested,
      'https://agentclientprotocol.com/protocol/v1/overview',
    )
    expect(index).toBe(2)
    expect(nested[index]?.label).toBe('Overview')
    const nav = syncWebNavigation(nested, 'https://agentclientprotocol.com/protocol/v1/overview')
    expect(nav.current?.label).toBe('Overview')
    expect(nav.next?.label).toBe('Initialization')
  })

  it('syncWebNavigation 返回相邻节', () => {
    const nav = syncWebNavigation(units, 'https://react.dev/learn/installation')
    expect(nav.current?.label).toBe('Installation')
    expect(nav.previous?.label).toBe('Quick Start')
    expect(nav.next).toBeNull()
  })
})
