import { mkdtemp, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let tempUserData = ''

vi.mock('electron', () => ({
  app: {
    getPath: () => tempUserData,
  },
}))

import {
  createReadingMark,
  deleteReadingMark,
  listReadingMarks,
  updateReadingMark,
} from './reading-marks-service'
import { isOk } from '@shared/core/result'

describe('reading-marks-service', () => {
  beforeEach(async () => {
    tempUserData = await mkdtemp(join(tmpdir(), 'reading-marks-'))
  })

  afterEach(() => {
    tempUserData = ''
  })

  it('创建、列出、更新并删除书签', async () => {
    const createResult = await createReadingMark({
      filePath: 'D:\\books\\demo.epub',
      fileFingerprint: 'fp-1',
      kind: 'bookmark',
      anchor: { format: 'epub', cfi: 'cfi-1' },
      label: '第一章',
    })
    expect(isOk(createResult)).toBe(true)
    if (!isOk(createResult)) return

    const listResult = await listReadingMarks('D:\\books\\demo.epub')
    expect(isOk(listResult)).toBe(true)
    if (!isOk(listResult)) return
    expect(listResult.value).toHaveLength(1)
    expect(listResult.value[0]?.label).toBe('第一章')

    const updateResult = await updateReadingMark({
      id: createResult.value.id,
      note: '读后感',
    })
    expect(isOk(updateResult)).toBe(true)
    if (!isOk(updateResult)) return
    expect(updateResult.value.note).toBe('读后感')

    const highlightResult = await updateReadingMark({
      id: createResult.value.id,
      note: '',
    })
    expect(isOk(highlightResult)).toBe(true)
    if (!isOk(highlightResult)) return
    expect(highlightResult.value.note).toBeUndefined()
    expect(highlightResult.value.kind).toBe('bookmark')

    const deleteResult = await deleteReadingMark(createResult.value.id)
    expect(isOk(deleteResult)).toBe(true)

    const emptyList = await listReadingMarks('D:\\books\\demo.epub')
    expect(isOk(emptyList)).toBe(true)
    if (!isOk(emptyList)) return
    expect(emptyList.value).toHaveLength(0)

    const raw = await readFile(join(tempUserData, 'reading-marks.json'), 'utf-8')
    expect(JSON.parse(raw)).toEqual({ marks: [] })
  })

  it('空路径创建失败', async () => {
    const result = await createReadingMark({
      filePath: '   ',
      fileFingerprint: 'fp',
      kind: 'bookmark',
      anchor: { format: 'pdf', page: 1 },
    })
    expect(isOk(result)).toBe(false)
  })
})
