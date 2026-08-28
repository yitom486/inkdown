export interface TextRange {
  from: number
  to: number
}

export interface PasteImageChange {
  changes: { from: number; to: number; insert: string }
  selection: { anchor: number }
}

/** 从剪贴板 items 中提取第一个图片 */
export function extractClipboardImage(
  items: DataTransferItemList | null | undefined,
): { blob: Blob; mimeType: string } | null {
  if (!items) return null

  for (const item of items) {
    if (!item.type.startsWith('image/')) continue

    const file = item.getAsFile()
    if (!file) continue

    return { blob: file, mimeType: item.type }
  }

  return null
}

/** 构建粘贴图片 markdown 后的编辑器变更 */
export function buildImagePasteChange(
  range: TextRange,
  markdown: string,
): PasteImageChange {
  return {
    changes: { from: range.from, to: range.to, insert: markdown },
    selection: { anchor: range.from + markdown.length },
  }
}

export type PasteImageHandler = (blob: Blob, mimeType: string) => Promise<string | null>

/** CodeMirror domEventHandlers.paste 回调 */
export function handlePasteImageEvent(
  event: ClipboardEvent,
  onPasteImage: PasteImageHandler | undefined,
  insertMarkdown: (markdown: string) => void,
): boolean {
  if (!onPasteImage) return false

  const image = extractClipboardImage(event.clipboardData?.items)
  if (!image) return false

  event.preventDefault()
  void onPasteImage(image.blob, image.mimeType).then((markdown) => {
    if (!markdown) return
    insertMarkdown(markdown)
  })
  return true
}
