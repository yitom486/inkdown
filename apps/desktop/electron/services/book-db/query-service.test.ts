import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { importBookPages } from './import-book'
import { closeAllBookDbs, openBookDb } from './open-book-db'
import { getRosettaBookInfo, queryRosettaBook } from './query-service'

let seedSeq = 0

function seedUserData(): { dir: string; fingerprint: string } {
  const dir = mkdtempSync(join(tmpdir(), 'rosetta-qsvc-'))
  seedSeq += 1
  const fingerprint = `qsvc-book-${Date.now()}-${seedSeq}`
  const db = openBookDb(dir, fingerprint)
  importBookPages(db, {
    fingerprint,
    title: '服务书',
    sourcePath: 'D:/book/s.pdf',
    format: 'pdf',
    pageCount: 2,
    pageOffset: 0,
    cleanVersion: 'v3',
    printedToc: [{ title: '第一章', printedPage: 1, level: 1 }],
    pages: [
      { page: 1, markdown: '# 第一章\n\n流水线提升吞吐率' },
      { page: 2, markdown: '取指译码执行' },
    ],
  })
  // openBookDb 句柄进程级缓存；用完即关，Windows 才删得掉文件
  closeAllBookDbs()
  return { dir, fingerprint }
}

describe('query-service', () => {
  it('未导入返回 INVALID_STATE，空指纹 INVALID_ARGUMENT', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rosetta-qsvc-empty-'))
    try {
      const missing = queryRosettaBook(dir, { kind: 'page', fingerprint: 'nope', page: 1 })
      expect(missing.ok).toBe(false)
      if (!missing.ok) expect(missing.error.code).toBe('INVALID_STATE')
      const bad = queryRosettaBook(dir, { kind: 'page', fingerprint: '  ', page: 1 })
      expect(bad.ok).toBe(false)
    } finally {
      closeAllBookDbs()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('五种查询全通，info 统计正确', () => {
    const { dir, fingerprint } = seedUserData()
    try {
      const info = getRosettaBookInfo(dir, fingerprint)
      expect(info.ok).toBe(true)
      if (!info.ok || !info.value) return
      expect(info.value).toMatchObject({ chapters: 1, blocks: 3, pages: 2 })

      const page = queryRosettaBook(dir, { kind: 'page', fingerprint, page: 1 })
      expect(page.ok && page.value.kind === 'page' && page.value.blocks).toHaveLength(2)

      const chapter = queryRosettaBook(dir, { kind: 'chapter', fingerprint, chapterIndex: 0 })
      expect(chapter.ok && chapter.value.kind === 'chapter' && chapter.value.blocks.length).toBe(3)

      const chapters = queryRosettaBook(dir, { kind: 'chapters', fingerprint })
      expect(chapters.ok).toBe(true)
      if (chapters.ok && chapters.value.kind === 'chapters') {
        expect(chapters.value.chapters).toEqual([{ index: 0, title: '第一章', startPage: 1, endPage: 2 }])
      }

      const search = queryRosettaBook(dir, { kind: 'search', fingerprint, keyword: '流水线' })
      expect(search.ok && search.value.kind === 'search' && search.value.blocks).toHaveLength(1)

      const context = queryRosettaBook(dir, {
        kind: 'context',
        fingerprint,
        chapterIndex: 0,
        blockIndex: 1,
        radius: 1,
      })
      expect(context.ok && context.value.kind === 'context' && context.value.blocks.length).toBe(3)

      const badPage = queryRosettaBook(dir, { kind: 'page', fingerprint, page: 0 })
      expect(badPage.ok).toBe(false)
    } finally {
      closeAllBookDbs()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('目录项查询：tocEntries 列表与 toc 范围读块，一级章读整章', () => {
    const { dir, fingerprint } = seedUserData()
    try {
      const info = getRosettaBookInfo(dir, fingerprint)
      expect(info.ok).toBe(true)
      if (!info.ok || !info.value) return
      expect(info.value.tocEntries).toBe(1)
      expect(info.value.tocSignature).not.toBe('')

      const list = queryRosettaBook(dir, { kind: 'tocEntries', fingerprint })
      expect(list.ok).toBe(true)
      if (!list.ok || list.value.kind !== 'tocEntries') return
      expect(list.value.tocEntries).toEqual([
        { tocIndex: 0, title: '第一章', level: 1, startPage: 1, endPage: 2 },
      ])

      const range = queryRosettaBook(dir, { kind: 'toc', fingerprint, tocIndex: 0 })
      expect(range.ok).toBe(true)
      if (!range.ok || range.value.kind !== 'toc') return
      expect(range.value.entry).toMatchObject({ tocIndex: 0, title: '第一章' })
      expect(range.value.blocks).toHaveLength(3)

      expect(queryRosettaBook(dir, { kind: 'toc', fingerprint, tocIndex: 99 }).ok).toBe(false)
      expect(queryRosettaBook(dir, { kind: 'toc', fingerprint, tocIndex: -1 }).ok).toBe(false)
    } finally {
      closeAllBookDbs()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
