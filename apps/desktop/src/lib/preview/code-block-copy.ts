/** 从代码块复制按钮解析待复制文本（纯函数，便于单测） */
export function getCodeBlockTextFromCopyButton(button: Element): string | null {
  const block = button.closest('.code-block')
  if (!block) return null

  const code = block.querySelector('code')
  if (code?.textContent?.trim()) return code.textContent

  const pre = block.querySelector('pre')
  const text = pre?.textContent
  return text && text.length > 0 ? text : null
}

export function applyCopyButtonFeedback(button: HTMLButtonElement, durationMs = 1500): () => void {
  button.classList.add('copied')
  button.setAttribute('aria-label', '已复制')
  const timer = window.setTimeout(() => {
    button.classList.remove('copied')
    button.setAttribute('aria-label', '复制代码')
  }, durationMs)
  return () => window.clearTimeout(timer)
}
