/**
 * 阅读器划词 Ctrl/Cmd+C 判定（纯函数，三阅读器共用）。
 *
 * 背景：划选后原生 Selection 已被清空（覆盖层接管视觉），系统剪贴板是空的，
 * 快捷键必须把 sticky 快照文本写进去；但输入框里的划词仍走原生复制。
 * Ctrl+V 永不拦截（阅读页只读，不实现粘贴）。
 */

export interface ReaderCopyShortcutKey {
  key: string
  code: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}

/** 可编辑目标仅在自身已有划选时放行原生复制；空框/caret 返回 false（阅读选区接管）。 */
export function isEditableCopyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  const editable = target.closest(
    [
      'input',
      'textarea',
      'select',
      '[contenteditable]:not([contenteditable="false"])',
      '[role="textbox"]',
      '.cm-editor',
      '.cm-content',
      '[role="dialog"]',
    ].join(', '),
  )
  if (!editable) return false
  // input/textarea：自身有划选才放行；空框/caret 照样接管（拷阅读快照）。
  // 划词后焦点常落在空 Agent 输入框，原生复制此时什么都没有，必须让路。
  if (editable instanceof HTMLInputElement || editable instanceof HTMLTextAreaElement) {
    return inputHasOwnSelection(editable)
  }
  // select 无文本选择概念：沿旧行为放行
  if (editable instanceof HTMLSelectElement) return true
  // 其余（contenteditable/textbox/对话框内文本）：所在文档有非折叠选区才放行
  const doc =
    typeof editable.ownerDocument !== 'undefined' && editable.ownerDocument !== null
      ? editable.ownerDocument
      : null
  return docHasUncollapsedSelection(doc)
}

function inputHasOwnSelection(input: HTMLInputElement | HTMLTextAreaElement): boolean {
  try {
    const { selectionStart, selectionEnd } = input
    // 非文本框（number/checkbox 等取不到选区）：无法证明为空，放行
    if (selectionStart === null || selectionEnd === null) return true
    return selectionStart !== selectionEnd
  } catch {
    return true
  }
}

function docHasUncollapsedSelection(doc: Document | null): boolean {
  try {
    const selection = doc?.getSelection?.()
    if (!selection || selection.isCollapsed) return false
    return selection.toString().trim().length > 0
  } catch {
    return false
  }
}

function isCopyKey(event: ReaderCopyShortcutKey): boolean {
  if (event.shiftKey || event.altKey) return false
  // Windows 用 ctrl，macOS 用 meta；key 与 code 双认（.by 布局/大小写）
  if (!event.ctrlKey && !event.metaKey) return false
  return event.key.toLowerCase() === 'c' || event.code === 'KeyC'
}

/**
 * 是否接管本次按键：有阅读选区 + C 键 + 焦点不在可编辑目标上才处理。
 * 无选区时返回 false（Electron editMenu 继续工作）；V 键永不处理。
 */
export function shouldHandleReaderCopyShortcut(
  event: ReaderCopyShortcutKey,
  target: EventTarget | null,
  hasSelection: boolean,
): boolean {
  if (!hasSelection) return false
  if (!isCopyKey(event)) return false
  if (isEditableCopyTarget(target)) return false
  return true
}
