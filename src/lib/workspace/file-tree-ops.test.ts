import { describe, expect, it } from 'vitest'
import {
  buildUniqueChildPath,
  getBaseName,
  getParentDir,
  listChildNames,
  toRelativePath,
} from './file-tree-ops'

describe('file-tree-ops', () => {
  it('parses parent and base name', () => {
    expect(getParentDir('D:\\ws\\docs\\a.md')).toBe('D:\\ws\\docs')
    expect(getBaseName('D:\\ws\\docs\\a.md')).toBe('a.md')
  })

  it('builds relative paths', () => {
    expect(toRelativePath('D:/ws/docs/a.md', 'D:/ws')).toBe('docs/a.md')
  })

  it('builds unique child paths', () => {
    expect(buildUniqueChildPath('D:/ws', 'a.md', new Set(['a.md']))).toBe('D:/ws/a copy.md')
  })

  it('lists child names under root and nested dirs', () => {
    const tree = [
      {
        name: 'docs',
        path: 'D:/ws/docs',
        type: 'directory' as const,
        children: [{ name: 'a.md', path: 'D:/ws/docs/a.md', type: 'file' as const }],
      },
      { name: 'README.md', path: 'D:/ws/README.md', type: 'file' as const },
    ]
    expect([...listChildNames(tree, 'D:/ws', 'D:/ws')].sort()).toEqual(['docs', 'readme.md'])
    expect([...listChildNames(tree, 'D:/ws/docs', 'D:/ws')]).toEqual(['a.md'])
  })
})
