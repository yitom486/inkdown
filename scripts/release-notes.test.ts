import { describe, expect, it } from 'vitest'
import { extractReleaseNotes, releaseVersionFromTag } from './release-notes'

const changelog = `# 更新日志

## [未发布]

---

## [0.2.8] - 2026-09-03

### 新功能

- 自动读取更新日志

---

## [0.2.7] - 2026-09-02

- 旧版本内容
`

describe('release notes', () => {
  it('从 tag 取得版本号', () => {
    expect(releaseVersionFromTag('v0.2.8')).toBe('0.2.8')
    expect(() => releaseVersionFromTag('main')).toThrow(/vX.Y.Z/)
  })

  it('提取指定版本的正文，不包含相邻版本', () => {
    expect(extractReleaseNotes(changelog, 'v0.2.8')).toBe(
      '## v0.2.8\n\n### 新功能\n\n- 自动读取更新日志\n',
    )
  })

  it('缺少对应版本时失败', () => {
    expect(() => extractReleaseNotes(changelog, 'v0.2.9')).toThrow(/找不到/)
  })
})
