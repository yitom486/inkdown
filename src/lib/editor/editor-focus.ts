/** 与 VS Code 一致：仅在 Markdown 编辑器获得焦点时，Ctrl+B 留给加粗 */
export function isMarkdownEditorFocused(): boolean {
  const active = document.activeElement
  if (!active) return false
  return active.closest('.cm-editor') !== null
}
