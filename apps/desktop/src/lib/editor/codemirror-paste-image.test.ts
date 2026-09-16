import { describe, expect, it } from 'vitest'
import {
  buildImagePasteChange,
  extractClipboardImage,
  handlePasteImageEvent,
} from './codemirror-paste-image'

describe('extractClipboardImage', () => {
  it('无 items 时返回 null', () => {
    expect(extractClipboardImage(null)).toBeNull()
    expect(extractClipboardImage(undefined)).toBeNull()
  })

  it('跳过非图片项', () => {
    const items = [
      { type: 'text/plain', getAsFile: () => null },
    ] as unknown as DataTransferItemList

    expect(extractClipboardImage(items)).toBeNull()
  })

  it('返回第一个图片项', () => {
    const blob = new Blob(['x'], { type: 'image/png' })
    const items = [
      { type: 'text/plain', getAsFile: () => null },
      { type: 'image/png', getAsFile: () => blob },
    ] as unknown as DataTransferItemList

    expect(extractClipboardImage(items)).toEqual({ blob, mimeType: 'image/png' })
  })
})

describe('buildImagePasteChange', () => {
  it('在选区位置插入 markdown 并移动光标', () => {
    expect(buildImagePasteChange({ from: 3, to: 8 }, '![img](assets/a.png)')).toEqual({
      changes: { from: 3, to: 8, insert: '![img](assets/a.png)' },
      selection: { anchor: 3 + '![img](assets/a.png)'.length },
    })
  })
})

describe('handlePasteImageEvent', () => {
  it('无 handler 时不处理', () => {
    const event = {
      clipboardData: { items: [] },
      preventDefault: () => {},
    } as unknown as ClipboardEvent
    expect(handlePasteImageEvent(event, undefined, () => {})).toBe(false)
  })

  it('检测到图片时 preventDefault 并异步插入', async () => {
    const blob = new Blob(['x'], { type: 'image/png' })
    let prevented = false
    const inserted: string[] = []

    const event = {
      clipboardData: {
        items: [{ type: 'image/png', getAsFile: () => blob }],
      },
      preventDefault: () => {
        prevented = true
      },
    } as unknown as ClipboardEvent

    const handled = handlePasteImageEvent(
      event,
      async () => '![pasted](assets/p.png)',
      (markdown) => inserted.push(markdown),
    )

    expect(handled).toBe(true)
    expect(prevented).toBe(true)
    await Promise.resolve()
    expect(inserted).toEqual(['![pasted](assets/p.png)'])
  })
})
