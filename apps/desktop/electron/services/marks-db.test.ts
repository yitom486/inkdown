import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let tempUserData = ''

vi.mock('electron', () => ({
  app: {
    getPath: () => tempUserData,
  },
}))

import { BOOK_DB_SCHEMA_VERSION, migrateBookDb } from './book-db/schema'
import { closeAllBookDbs, openBookDb } from './book-db/open-book-db'
import {
  createReadingMark,
  deleteReadingMark,
  listReadingMarks,
  updateReadingMark,
} from './reading-marks-service'
import {
  exportMarksStore,
  importMarksStore,
  resolveFingerprintForFile,
  searchMarks,
} from './marks-db'
import { isOk } from '@inkdown/contracts'
import { toChapterKey } from '@inkdown/contracts'

describe('marks-db（[2]-01 卡片 SQL 后端）', () => {
  beforeEach(async () => {
    delete process.env.INKDOWN_MARKS_BACKEND
    tempUserData = await mkdtemp(join(tmpdir(), 'marks-db-'))
  })

  afterEach(() => {
    closeAllBookDbs()
    // 先关句柄再删目录（Windows 占文件删不掉）；用后即焚，不留 tmp 堆积
    if (tempUserData) rmSync(tempUserData, { recursive: true, force: true })
    tempUserData = ''
  })

  it('v5 迁移建 marks/marks_tombstones/marks_fts 与触发器', () => {
    const db = new DatabaseSync(':memory:')
    try {
      const result = migrateBookDb(db)
      expect(result.version).toBe(BOOK_DB_SCHEMA_VERSION)
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'trigger')")
        .all() as Array<{ name: string }>
      const names = new Set(tables.map((row) => row.name))
      for (const expected of [
        'marks',
        'marks_tombstones',
        'marks_fts',
        'marks_ai',
        'marks_ad',
        'marks_au',
      ]) {
        expect(names.has(expected)).toBe(true)
      }
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'marks'")
        .all() as Array<{ name: string }>
      expect(indexes.map((row) => row.name)).toContain('idx_marks_chapter_key')
    } finally {
      db.close()
    }
  })

  it('增删改查走本书库：固化章节 round-trip，软删除记 tombstone', async () => {
    const created = await createReadingMark({
      filePath: 'D:\\books\\demo.epub',
      fileFingerprint: 'fp-1',
      kind: 'highlight',
      anchor: { format: 'epub', cfi: 'cfi-1', cfiRange: 'cfi-r1' },
      excerpt: '托克维尔参观了荒野',
      category: 'concept',
      chapter: { key: toChapterKey('text/part1'), label: '第一部分', index: 3 },
    })
    expect(isOk(created)).toBe(true)
    if (!isOk(created)) return

    const listed = await listReadingMarks('D:\\books\\demo.epub')
    expect(isOk(listed)).toBe(true)
    if (!isOk(listed)) return
    expect(listed.value).toHaveLength(1)
    // 固化章节原样回来（含 label/index，不止 key）
    expect(listed.value[0]?.chapter).toEqual({
      key: 'text/part1',
      label: '第一部分',
      index: 3,
    })

    const updated = await updateReadingMark({ id: created.value.id, note: '读后感' })
    expect(isOk(updated)).toBe(true)
    if (!isOk(updated)) return
    expect(updated.value.note).toBe('读后感')
    expect(updated.value.chapter?.key).toBe('text/part1')

    const deleted = await deleteReadingMark(created.value.id)
    expect(isOk(deleted)).toBe(true)

    const empty = await listReadingMarks('D:\\books\\demo.epub')
    expect(isOk(empty)).toBe(true)
    if (!isOk(empty)) return
    expect(empty.value).toHaveLength(0)

    // 同步口径：导出无此卡，tombstone 有记录
    const exported = exportMarksStore(tempUserData)
    expect(exported.marks).toHaveLength(0)
    expect(typeof exported.tombstones?.[created.value.id]).toBe('number')

    // 更新/删除不存在的卡与文件版同错
    expect(isOk(await updateReadingMark({ id: 'nope', note: 'x' }))).toBe(false)
    expect(isOk(await deleteReadingMark('nope'))).toBe(false)
  })

  it('分书隔离：两本书的卡互不可见', async () => {
    for (const fp of ['fp-a', 'fp-b']) {
      const result = await createReadingMark({
        filePath: `D:\\books\\${fp}.epub`,
        fileFingerprint: fp,
        kind: 'bookmark',
        anchor: { format: 'epub', cfi: `cfi-${fp}` },
      })
      expect(isOk(result)).toBe(true)
    }
    const listA = await listReadingMarks('D:\\books\\fp-a.epub')
    const listB = await listReadingMarks('D:\\books\\fp-b.epub')
    expect(isOk(listA) && isOk(listB)).toBe(true)
    if (!isOk(listA) || !isOk(listB)) return
    expect(listA.value).toHaveLength(1)
    expect(listB.value).toHaveLength(1)
    expect(listA.value[0]?.fileFingerprint).toBe('fp-a')
  })

  it('FTS 搜标题/摘录/批注走索引（EXPLAIN 抽查）', async () => {
    const created = await createReadingMark({
      filePath: 'D:\\books\\fts.epub',
      fileFingerprint: 'fp-fts',
      kind: 'note',
      anchor: { format: 'epub', cfi: 'cfi-fts' },
      excerpt: '荒野求生指南',
      note: '托克维尔的观察',
    })
    expect(isOk(created)).toBe(true)

    expect(searchMarks(tempUserData, 'fp-fts', '荒野求生')).toHaveLength(1)
    expect(searchMarks(tempUserData, 'fp-fts', '托克维尔')).toHaveLength(1)
    // <3 字走 LIKE 兜底（trigram 原理限制）
    expect(searchMarks(tempUserData, 'fp-fts', '荒野')).toHaveLength(1)
    expect(searchMarks(tempUserData, 'fp-fts', '不存在的词')).toHaveLength(0)
    expect(searchMarks(tempUserData, 'fp-fts', '   ')).toHaveLength(0)

    const db = openBookDb(tempUserData, 'fp-fts')
    const plan = db
      .prepare(
        `EXPLAIN QUERY PLAN SELECT m.* FROM marks_fts JOIN marks m ON m.rowid = marks_fts.rowid
         WHERE marks_fts MATCH ? AND m.deleted_at IS NULL`,
      )
      .all('荒野') as Array<{ detail: string }>
    expect(plan.some((row) => /marks_fts/i.test(row.detail))).toBe(true)

    const chapterPlan = db
      .prepare('EXPLAIN QUERY PLAN SELECT * FROM marks WHERE chapter_key = ?')
      .all('x') as Array<{ detail: string }>
    expect(chapterPlan.some((row) => /idx_marks_chapter_key/i.test(row.detail))).toBe(true)
  })

  it('存量迁移：JSON 按指纹灌库、对账一致、落 .bak 与 marker', async () => {
    const store = {
      marks: [
        {
          id: 'm-1',
          filePath: 'D:\\books\\a.epub',
          fileFingerprint: 'fp-a',
          kind: 'highlight',
          anchor: { format: 'epub', cfi: 'c1' },
          excerpt: '摘录一',
          createdAt: 1,
          updatedAt: 2,
        },
        {
          id: 'm-2',
          filePath: 'D:\\books\\b.epub',
          fileFingerprint: 'fp-b',
          kind: 'note',
          anchor: { format: 'pdf', page: 3 },
          note: '批注二',
          createdAt: 3,
          updatedAt: 4,
        },
      ],
      tombstones: { 'm-old': 5 },
    }
    await writeFile(join(tempUserData, 'reading-marks.json'), JSON.stringify(store))

    // 首个 DB 操作触发懒迁移
    const listed = await listReadingMarks('D:\\books\\a.epub')
    expect(isOk(listed)).toBe(true)
    if (!isOk(listed)) return
    expect(listed.value.map((mark) => mark.id)).toEqual(['m-1'])

    const listedB = await listReadingMarks('D:\\books\\b.epub')
    expect(isOk(listedB)).toBe(true)
    if (!isOk(listedB)) return
    expect(listedB.value).toHaveLength(1)
    expect(listedB.value[0]?.note).toBe('批注二')

    const raw = await readFile(join(tempUserData, 'reading-marks.json.bak'), 'utf-8')
    expect(JSON.parse(raw).marks).toHaveLength(2)
    const marker = await readFile(
      join(tempUserData, 'reading-marks.json.migrated-to-db'),
      'utf-8',
    )
    expect(JSON.parse(marker).migrated).toBe(2)

    // 迁移幂等：重复触发不翻倍
    await listReadingMarks('D:\\books\\a.epub')
    const again = await listReadingMarks('D:\\books\\a.epub')
    expect(isOk(again)).toBe(true)
    if (!isOk(again)) return
    expect(again.value).toHaveLength(1)
  })

  it('同步兼容：导出 ⇄ 导入 round-trip（含 tombstones）', async () => {
    const created = await createReadingMark({
      filePath: 'D:\\books\\sync.epub',
      fileFingerprint: 'fp-sync',
      kind: 'highlight',
      anchor: { format: 'epub', cfi: 'c-sync' },
      excerpt: '同步摘录',
    })
    expect(isOk(created)).toBe(true)
    if (!isOk(created)) return
    expect(isOk(await deleteReadingMark(created.value.id))).toBe(true)

    const exported = exportMarksStore(tempUserData)
    expect(exported.marks).toHaveLength(0)
    const exportedTombs = exported.tombstones ?? {}
    expect(Object.keys(exportedTombs)).toContain(created.value.id)

    // 异机导入：卡回来，tombstone 生效（删过的卡不复活）
    const fresh = await mkdtemp(join(tmpdir(), 'marks-db-fresh-'))
    try {
      importMarksStore(fresh, {
        marks: [
          {
            ...created.value,
            id: 'm-new',
            filePath: 'D:\\books\\sync.epub',
            fileFingerprint: 'fp-sync',
          },
        ],
        tombstones: exported.tombstones,
      })
      const check = exportMarksStore(fresh)
      expect(check.marks.map((mark) => mark.id)).toEqual(['m-new'])
      expect(check.tombstones?.[created.value.id]).toBe(exportedTombs[created.value.id])
    } finally {
      closeAllBookDbs()
      rmSync(fresh, { recursive: true, force: true })
    }
  })

  it('filePath 反查指纹：未索引书走 marks 兜底', async () => {
    const created = await createReadingMark({
      filePath: 'D:\\books\\loose.epub',
      fileFingerprint: 'fp-loose',
      kind: 'bookmark',
      anchor: { format: 'epub', cfi: 'c-loose' },
    })
    expect(isOk(created)).toBe(true)
    // 该书从未索引（books 表为空），靠 marks.file_path 兜底定位
    expect(resolveFingerprintForFile(tempUserData, 'D:\\books\\loose.epub')).toBe('fp-loose')
    expect(resolveFingerprintForFile(tempUserData, 'D:\\books\\ghost.epub')).toBeNull()
  })
})
