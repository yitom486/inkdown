import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isOk } from '@shared/core/result'
import {
  discoverWebDocToc,
  fetchWebDocPage,
  parseWebDocUrlInput,
  validateWebDocUrl,
} from './web-doc-service'

describe('web-doc-service', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        if (input.includes('fail.example')) {
          return new Response('nope', { status: 500, headers: { 'content-type': 'text/html' } })
        }
        const html = `<!DOCTYPE html><html><head><title>Docs</title></head><body>
          <article><h1>Page</h1><p>text</p></article>
          <a href="/learn/installation">Install</a>
          <a href="https://other.example/x">External</a>
        </body></html>`
        return new Response(html, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('拒绝非 http(s) URL', () => {
    const result = validateWebDocUrl('file:///etc/passwd')
    expect(result.ok).toBe(false)
  })

  it('规范化 URL 并去掉 hash', () => {
    const result = validateWebDocUrl('https://react.dev/learn#setup')
    expect(isOk(result)).toBe(true)
    if (!isOk(result)) return
    expect(result.value).toBe('https://react.dev/learn')
  })

  it('fetch 返回 HTML', async () => {
    const result = await fetchWebDocPage({ url: 'https://react.dev/learn' })
    expect(isOk(result)).toBe(true)
    if (!isOk(result)) return
    expect(result.value.html).toContain('<article>')
  })

  it('HTTP 错误返回 FILE_READ_ERROR', async () => {
    const result = await fetchWebDocPage({ url: 'https://fail.example/docs' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('FILE_READ_ERROR')
  })

  it('discoverToc 仅保留同站链接', async () => {
    const result = await discoverWebDocToc({ url: 'https://react.dev/learn' })
    expect(isOk(result)).toBe(true)
    if (!isOk(result)) return
    expect(result.value.siteId).toBe('react-dev')
    expect(result.value.entries.some((e) => e.href.includes('/learn/installation'))).toBe(true)
    expect(result.value.entries.every((e) => e.href.startsWith('https://react.dev'))).toBe(true)
  })

  it('parseWebDocUrlInput 校验空字符串', () => {
    expect(parseWebDocUrlInput('  ').ok).toBe(false)
  })
})
