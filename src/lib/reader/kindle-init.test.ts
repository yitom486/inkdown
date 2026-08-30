import { beforeEach, describe, expect, it, vi } from 'vitest'

const { initKf8File, initMobiFile } = vi.hoisted(() => ({
  initKf8File: vi.fn(),
  initMobiFile: vi.fn(),
}))

vi.mock('@lingo-reader/mobi-parser', () => ({
  initKf8File,
  initMobiFile,
}))

import {
  initDualFormatMobiFile,
  initKindleFile,
  isKf8KindleExtension,
} from './kindle-init'

function createKf8Stub(spineLength = 2) {
  return {
    getSpine: () => Array.from({ length: spineLength }, (_, index) => ({ id: String(index) })),
    destroy: vi.fn(),
  }
}

describe('isKf8KindleExtension', () => {
  it('识别 AZW3/AZW 为 KF8', () => {
    expect(isKf8KindleExtension('/books/demo.azw3')).toBe(true)
    expect(isKf8KindleExtension('/books/demo.AZW')).toBe(true)
    expect(isKf8KindleExtension('/books/demo.mobi')).toBe(false)
  })
})

describe('initDualFormatMobiFile', () => {
  beforeEach(() => {
    initKf8File.mockReset()
    initMobiFile.mockReset()
  })

  it('KF8 解析成功时优先返回 KF8 实例', async () => {
    const kf8 = createKf8Stub()
    initKf8File.mockResolvedValue(kf8)

    const book = await initDualFormatMobiFile(new Uint8Array([1, 2, 3]))

    expect(book).toBe(kf8)
    expect(initMobiFile).not.toHaveBeenCalled()
  })

  it('KF8 解析失败时回退经典 MOBI', async () => {
    const mobi = { getSpine: () => [], destroy: vi.fn() }
    initKf8File.mockRejectedValue(new Error('Missing FDST record'))
    initMobiFile.mockResolvedValue(mobi)

    const book = await initDualFormatMobiFile(new Uint8Array([1, 2, 3]))

    expect(book).toBe(mobi)
    expect(initMobiFile).toHaveBeenCalledOnce()
  })

  it('KF8 spine 为空时销毁并回退经典 MOBI', async () => {
    const kf8 = createKf8Stub(0)
    const mobi = { getSpine: () => [{ id: '0' }], destroy: vi.fn() }
    initKf8File.mockResolvedValue(kf8)
    initMobiFile.mockResolvedValue(mobi)

    const book = await initDualFormatMobiFile(new Uint8Array([1, 2, 3]))

    expect(kf8.destroy).toHaveBeenCalledOnce()
    expect(book).toBe(mobi)
  })
})

describe('initKindleFile', () => {
  beforeEach(() => {
    initKf8File.mockReset()
    initMobiFile.mockReset()
  })

  it('azw3 扩展名直接走 KF8', async () => {
    const kf8 = createKf8Stub()
    initKf8File.mockResolvedValue(kf8)

    const book = await initKindleFile(new Uint8Array([1]), '/books/demo.azw3')

    expect(book).toBe(kf8)
    expect(initMobiFile).not.toHaveBeenCalled()
  })

  it('mobi 扩展名走双格式探测', async () => {
    const kf8 = createKf8Stub()
    initKf8File.mockResolvedValue(kf8)

    const book = await initKindleFile(new Uint8Array([1]), '/books/demo.mobi')

    expect(book).toBe(kf8)
    expect(initKf8File).toHaveBeenCalledOnce()
  })
})
