import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveMarkTarget } from '@/lib/agent/context/resolve-mark-target'

const readSelectionText = vi.fn()
const hasActiveSelection = vi.fn()
const getReaderMarksProvider = vi.fn()
const getReaderContentProvider = vi.fn()
const readViewportText = vi.fn()
const readCurrentDocumentText = vi.fn()
const readChapterByRef = vi.fn()

vi.mock('@/lib/agent/context/reader-selection-registry', () => ({
  readSelectionText: (...args: unknown[]) => readSelectionText(...args),
  hasActiveSelection: () => hasActiveSelection(),
}))

vi.mock('@/lib/agent/context/reader-marks-registry', () => ({
  getReaderMarksProvider: () => getReaderMarksProvider(),
}))

vi.mock('@/lib/agent/context/reader-content-registry', () => ({
  getReaderContentProvider: () => getReaderContentProvider(),
  readViewportText: (...args: unknown[]) => readViewportText(...args),
  readCurrentDocumentText: (...args: unknown[]) => readCurrentDocumentText(...args),
}))

vi.mock('@/lib/agent/context/read-chapter-by-ref', () => ({
  readChapterByRef: (...args: unknown[]) => readChapterByRef(...args),
}))

vi.mock('@/stores/reader-navigation-store', () => ({
  useReaderNavigationStore: {
    getState: () => ({
      nav: { flatIndex: 2 },
      units: [{ label: '第三章' }, { label: '第四章' }, { label: '第五章' }],
    }),
  },
}))

describe('resolveMarkTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getReaderMarksProvider.mockReturnValue({ filePath: '/book.epub' })
    hasActiveSelection.mockReturnValue(true)
  })

  it('选区与 excerpt 匹配时走 selection', async () => {
    readSelectionText.mockReturnValue('hello world')
    const result = await resolveMarkTarget({ excerpt: 'hello', note: '批注' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.target.resolution).toBe('selection')
      expect(result.target.excerpt).toBe('hello world')
      expect(result.target.note).toBe('批注')
    }
  })

  it('无 excerpt 且无选区时报错', async () => {
    readSelectionText.mockReturnValue('')
    const result = await resolveMarkTarget({ excerpt: '', note: '' })
    expect(result).toEqual({
      ok: false,
      reason: '需要摘录原文或当前选区；无选区时请提供 excerpt 参数',
    })
  })

  it('flatIndex 章内找到 excerpt', async () => {
    readSelectionText.mockReturnValue('')
    readChapterByRef.mockResolvedValue({ label: '第五章', text: 'foo bar baz' })
    const result = await resolveMarkTarget({
      excerpt: 'bar baz',
      note: '',
      flatIndex: 4,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.target.resolution).toBe('excerpt-flat-index')
      expect(result.target.flatIndex).toBe(4)
      expect(result.target.locationHint).toBe('第五章')
    }
  })

  it('视口模糊命中口述 hint', async () => {
    readSelectionText.mockReturnValue('')
    getReaderContentProvider.mockReturnValue({
      filePath: '/book.epub',
      getViewportText: () => Promise.resolve(''),
    })
    readViewportText.mockResolvedValue(
      'Java 广泛应用于互联网、金融、能源等领域，适合企业级开发。',
    )
    const result = await resolveMarkTarget({ excerpt: '如互联网能源', note: 'n' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.target.resolution).toBe('excerpt-viewport-fuzzy')
      expect(result.target.excerpt).toContain('互联网')
      expect(result.target.locationHint).toContain('推测匹配')
    }
  })
})
