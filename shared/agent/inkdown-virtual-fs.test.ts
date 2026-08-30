import { describe, expect, it } from 'vitest'
import {
  isInkdownVirtualDirPath,
  parseInkdownVirtualPath,
} from './inkdown-virtual-fs'

const ROOT = 'D:/books/workspace'

describe('parseInkdownVirtualPath', () => {
  it('识别绝对路径', () => {
    expect(parseInkdownVirtualPath(`${ROOT}/.inkdown/agent/toc.json`, ROOT)).toBe('toc.json')
  })

  it('识别 Windows 反斜杠路径', () => {
    expect(
      parseInkdownVirtualPath('D:\\books\\workspace\\.inkdown\\agent\\focused.json', ROOT),
    ).toBe('focused.json')
  })

  it('识别相对路径与 ./ 前缀', () => {
    expect(parseInkdownVirtualPath('.inkdown/agent/toc.json', ROOT)).toBe('toc.json')
    expect(parseInkdownVirtualPath('./.inkdown/agent/toc.json', ROOT)).toBe('toc.json')
  })

  it('普通文件返回 null', () => {
    expect(parseInkdownVirtualPath(`${ROOT}/README.md`, ROOT)).toBeNull()
    expect(parseInkdownVirtualPath('src/App.tsx', ROOT)).toBeNull()
  })

  it('虚拟目录下的未知资源返回 null，但能被目录判定捕获', () => {
    const unknown = `${ROOT}/.inkdown/agent/chapter.txt`
    expect(parseInkdownVirtualPath(unknown, ROOT)).toBeNull()
    expect(isInkdownVirtualDirPath(unknown, ROOT)).toBe(true)
  })

  it('同名前缀目录不误判', () => {
    expect(isInkdownVirtualDirPath(`${ROOT}/.inkdown/agentlog/a.txt`, ROOT)).toBe(false)
    expect(parseInkdownVirtualPath(`${ROOT}/.inkdown-agent/toc.json`, ROOT)).toBeNull()
  })
})
