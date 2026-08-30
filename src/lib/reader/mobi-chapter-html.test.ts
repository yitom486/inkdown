import { describe, expect, it } from 'vitest'
import {
  isMobiChapterReadable,
  normalizeMobiChapterHtml,
} from './mobi-chapter-html'

describe('normalizeMobiChapterHtml', () => {
  it('移除 XML 声明并提取 body', () => {
    const raw = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html><head><title>x</title></head>
<body><p>正文</p></body></html>`

    expect(normalizeMobiChapterHtml(raw)).toBe('<p>正文</p>')
  })

  it('移除 pagebreak 切分后的 XML orphan 片段', () => {
    expect(normalizeMobiChapterHtml('version="1.0" encoding="utf-8"?>')).toBe('')
    expect(normalizeMobiChapterHtml('version="1.0" encoding="utf-8"?><p>正文</p>')).toBe(
      '<p>正文</p>',
    )
  })
})

describe('isMobiChapterReadable', () => {
  it('识别只剩 XML 头的脏章节', () => {
    expect(isMobiChapterReadable('<?xml version="1.0" encoding="UTF-8"?>')).toBe(false)
    expect(isMobiChapterReadable('version="1.0" encoding="utf-8"?>')).toBe(false)
    expect(isMobiChapterReadable('<p>这是一段足够长的正文内容用于测试。</p>')).toBe(true)
    expect(isMobiChapterReadable('<p>目录</p>')).toBe(true)
  })
})
