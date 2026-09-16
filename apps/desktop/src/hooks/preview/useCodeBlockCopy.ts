import { useEffect, type RefObject } from 'react'
import { toast } from 'sonner'
import {
  applyCopyButtonFeedback,
  getCodeBlockTextFromCopyButton,
} from '@/lib/preview/code-block-copy'

/** 在容器内委托处理 `.code-block-copy` 点击；`revision` 变化时重绑（如消息列表更新） */
export function useCodeBlockCopy(
  containerRef: RefObject<HTMLElement | null>,
  revision?: unknown,
) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let clearFeedback: (() => void) | undefined

    const handleCopy = async (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const button = target.closest<HTMLButtonElement>('.code-block-copy')
      if (!button) return

      const text = getCodeBlockTextFromCopyButton(button)
      if (!text) return

      event.preventDefault()
      event.stopPropagation()
      try {
        await navigator.clipboard.writeText(text)
        clearFeedback?.()
        clearFeedback = applyCopyButtonFeedback(button)
        toast.success('代码已复制')
      } catch (error) {
        console.error('复制代码失败：', error)
      }
    }

    container.addEventListener('click', handleCopy)
    return () => {
      container.removeEventListener('click', handleCopy)
      clearFeedback?.()
    }
  }, [containerRef, revision])
}
