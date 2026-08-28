import { RenderingCancelledException } from 'pdfjs-dist'

/** pdf.js 取消渲染或 canvas 并发冲突时不应向用户报错 */
export function isPdfRenderCancelled(cause: unknown): boolean {
  if (cause instanceof RenderingCancelledException) return true
  if (cause instanceof Error) {
    return (
      cause.name === 'RenderingCancelledException' ||
      cause.message.includes('Rendering cancelled') ||
      cause.message.includes('same canvas during multiple render')
    )
  }
  return false
}
