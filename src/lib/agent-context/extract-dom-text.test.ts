// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { extractDocumentText, extractViewportText, htmlToText } from './extract-dom-text'

describe('htmlToText', () => {
  it('剥离标签保留文本', () => {
    expect(htmlToText('<p>你好 <b>世界</b></p>')).toBe('你好 世界')
  })
})

describe('extractDocumentText', () => {
  it('空文档返回空串', () => {
    expect(extractDocumentText(null)).toBe('')
  })
})

describe('extractViewportText', () => {
  it('空 document 返回空串', () => {
    expect(extractViewportText(null)).toBe('')
  })

  it('无有效布局时退回全文', () => {
    const doc = new DOMParser().parseFromString(
      '<html><body><p>第一段</p><p>第二段</p></body></html>',
      'text/html',
    )
    const text = extractViewportText(doc)
    expect(text).toContain('第一段')
  })
})
