import { describe, expect, it } from 'vitest'
import {
  extractGenericWebDocToc,
  extractSameOriginDocLinks,
  extractStructuredNavToc,
  pickDocsNavHtml,
} from './extract-toc-links'

const MINTLIFY_SIDEBAR_FIXTURE = `<!DOCTYPE html><html><body>
<nav aria-label="Pages" id="sidebar">
  <a href="/"><span class="sr-only">Agent Client Protocol home page</span></a>
  <div>
    <h3 class="sidebar-title"><span>Get Started</span></h3>
  </div>
  <ul class="sidebar-group">
    <li data-title="Introduction"><a href="/get-started/introduction">Introduction</a></li>
    <li data-title="Architecture"><a href="/get-started/architecture">Architecture</a></li>
    <li data-title="Agents"><a href="/get-started/agents">Agents</a></li>
  </ul>
  <div>
    <h3 class="sidebar-title"><span>Protocol</span></h3>
  </div>
  <ul class="sidebar-group">
    <ul>
      <li><a href="/protocol/v1/overview">Overview</a></li>
      <li><a href="/protocol/v1/initialization">Initialization</a></li>
      <li><a href="/protocol/v1/prompt-turn">Prompt Turn</a></li>
    </ul>
  </ul>
  <div>
    <h3 class="sidebar-title"><span>Libraries</span></h3>
  </div>
  <ul class="sidebar-group">
    <li><a href="/libraries/kotlin">Kotlin</a></li>
    <li><a href="/libraries/python">Python</a></li>
  </ul>
  <ul>
    <li><a href="https://github.com/agentclientprotocol/agent-client-protocol">GitHub</a></li>
  </ul>
</nav>
<main><a href="/other">Other page buried in content</a></main>
</body></html>`

describe('extractStructuredNavToc', () => {
  it('识别 Mintlify sidebar nav', () => {
    const nav = pickDocsNavHtml(MINTLIFY_SIDEBAR_FIXTURE)
    expect(nav).toContain('id="sidebar"')
  })

  it('保留分组标题与层级，且不按字母打乱', () => {
    const entries = extractStructuredNavToc(
      MINTLIFY_SIDEBAR_FIXTURE,
      'https://agentclientprotocol.com/protocol/v1/overview',
    )

    expect(entries.map((e) => `${e.level}:${e.label}`)).toEqual([
      '0:Agent Client Protocol home page',
      '0:Get Started',
      '1:Introduction',
      '1:Architecture',
      '1:Agents',
      '0:Protocol',
      '1:Overview',
      '1:Initialization',
      '1:Prompt Turn',
      '0:Libraries',
      '1:Kotlin',
      '1:Python',
    ])

    expect(entries.find((e) => e.label === 'Get Started')?.href).toBe(
      'https://agentclientprotocol.com/get-started/introduction',
    )
    expect(entries.some((e) => e.label === 'GitHub')).toBe(false)
    expect(entries.some((e) => e.label === 'Other page buried in content')).toBe(false)
  })
})

describe('extractGenericWebDocToc', () => {
  it('有结构化侧栏时不走扁平字母排序兜底', () => {
    const entries = extractGenericWebDocToc(
      MINTLIFY_SIDEBAR_FIXTURE,
      'https://agentclientprotocol.com/protocol/v1/overview',
    )
    expect(entries[1]?.label).toBe('Get Started')
    expect(entries.some((e) => e.level === 1)).toBe(true)
  })

  it('无侧栏时回退扁平同站链接', () => {
    const html = `<html><body>
      <a href="/b">Beta</a>
      <a href="/a">Alpha</a>
      <a href="https://example.com/x">External</a>
    </body></html>`
    const flat = extractSameOriginDocLinks(html, 'https://docs.example.com/')
    const generic = extractGenericWebDocToc(html, 'https://docs.example.com/')
    expect(flat.map((e) => e.label)).toEqual(['Beta', 'Alpha'])
    expect(generic.map((e) => e.label)).toEqual(['Beta', 'Alpha'])
  })
})
