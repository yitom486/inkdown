export function isReaderSelectionToolbarTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('[aria-label="选区操作"]'))
}

export function clearWindowSelection(win: Window | null | undefined): void {
  win?.getSelection()?.removeAllRanges()
}

/** 选区折叠时同步关闭工具栏（不重复 removeAllRanges） */
export function bindDocumentSelectionCollapse(
  doc: Document,
  win: Window,
  onCollapse: () => void,
): () => void {
  const onSelectionChange = () => {
    const selection = win.getSelection()
    if (selection && !selection.isCollapsed && selection.toString().trim()) return
    onCollapse()
  }

  doc.addEventListener('selectionchange', onSelectionChange)
  return () => doc.removeEventListener('selectionchange', onSelectionChange)
}

/** 收起浏览器高亮，但不影响 Agent sticky 选区 */
export function dimWindowSelection(win: Window | null | undefined): void {
  clearWindowSelection(win)
}

/** 点击阅读区外（侧栏、导航等）时清除选区 */
export function bindOutsideReaderPointerDismiss(
  isInsideReader: (target: Element) => boolean,
  onDismiss: () => void,
): () => void {
  const onPointerDown = (event: PointerEvent) => {
    if (!(event.target instanceof Element)) return
    if (isReaderSelectionToolbarTarget(event.target)) return
    if (isInsideReader(event.target)) return
    onDismiss()
  }

  document.addEventListener('pointerdown', onPointerDown, true)
  return () => document.removeEventListener('pointerdown', onPointerDown, true)
}

interface EpubRenditionContents {
  window?: Window
}

export function clearEpubRenditionSelections(
  rendition: { getContents: () => unknown } | null | undefined,
): void {
  if (!rendition) return

  const raw = rendition.getContents()
  const contentsList = (Array.isArray(raw) ? raw : raw ? [raw] : []) as EpubRenditionContents[]
  for (const contents of contentsList) {
    clearWindowSelection(contents.window)
  }
}
