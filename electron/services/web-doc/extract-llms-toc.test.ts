import { describe, expect, it } from 'vitest'
import {
  extractLlmsTxtToc,
  humanizePathSegment,
  normalizeLlmsDocHref,
  structuralPathParts,
} from './extract-llms-toc'

const LLMS_FIXTURE = `# Agent Client Protocol

- [Introduction](https://agentclientprotocol.com/get-started/introduction.md): Get started
- [Architecture](https://agentclientprotocol.com/get-started/architecture.md): Overview
- [Overview](https://agentclientprotocol.com/protocol/v1/overview.md): How ACP works
- [Initialization](https://agentclientprotocol.com/protocol/v1/initialization.md): Begin
- [Overview](https://agentclientprotocol.com/protocol/v2/overview.md): v2 draft
- [Kotlin](https://agentclientprotocol.com/libraries/kotlin.md): Kotlin library
- [Brand](https://agentclientprotocol.com/brand.md): Brand assets
`

describe('extractLlmsTxtToc', () => {
  it('不把 URL 中的 v1 加成强制中间层，页面直接挂在 Protocol 下', () => {
    const entries = extractLlmsTxtToc(LLMS_FIXTURE, 'https://agentclientprotocol.com')
    expect(entries.map((e) => `${e.level}:${e.label}`)).toEqual([
      '0:Get Started',
      '1:Introduction',
      '1:Architecture',
      '0:Protocol',
      '1:Overview',
      '1:Initialization',
      '1:Overview (v2)',
      '0:Libraries',
      '1:Kotlin',
      '0:Brand',
    ])
    expect(entries.find((e) => e.label === 'Overview')?.href).toContain('/protocol/v1/overview')
    expect(normalizeLlmsDocHref('/protocol/v1/overview.md', 'https://agentclientprotocol.com')).toBe(
      'https://agentclientprotocol.com/protocol/v1/overview',
    )
  })

  it('structuralPathParts 剥离版本段', () => {
    expect(structuralPathParts(['protocol', 'v1', 'overview'])).toEqual({
      groupParts: ['protocol'],
      leafPart: 'overview',
      version: 'v1',
    })
    expect(humanizePathSegment('get-started')).toBe('Get Started')
  })
})
