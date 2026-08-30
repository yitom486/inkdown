import { useCallback, useEffect, useRef } from 'react'

/**
 * 将依赖文字几何的工作合并到连续两帧之后执行。
 * 第一帧提交字体/宽度样式，第二帧等待 iframe 完成换行，再读取 ClientRect。
 */
export function useDeferredReaderLayout(callback: () => void): () => void {
  const callbackRef = useRef(callback)
  const frameRef = useRef<{ first: number; second: number }>({ first: 0, second: 0 })
  callbackRef.current = callback

  const cancel = useCallback(() => {
    if (frameRef.current.first !== 0) {
      window.cancelAnimationFrame(frameRef.current.first)
    }
    if (frameRef.current.second !== 0) {
      window.cancelAnimationFrame(frameRef.current.second)
    }
    frameRef.current = { first: 0, second: 0 }
  }, [])

  const schedule = useCallback(() => {
    cancel()
    frameRef.current.first = window.requestAnimationFrame(() => {
      frameRef.current.first = 0
      frameRef.current.second = window.requestAnimationFrame(() => {
        frameRef.current.second = 0
        callbackRef.current()
      })
    })
  }, [cancel])

  useEffect(() => cancel, [cancel])

  return schedule
}
