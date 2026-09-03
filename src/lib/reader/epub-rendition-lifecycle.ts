interface EpubRenditionQueue {
  stop?: () => void
  clear?: () => void
}

/**
 * epub.js 在 Rendition 构造时把 `start` 放入 requestAnimationFrame 队列。
 * `Book.destroy()` 会清空 rendition.book，却不会停止该队列；若组件在书籍打开前
 * 卸载（包括 Vite HMR），遗留的 start 会在下一帧读取 undefined.package。
 */
export function stopPendingEpubRenditionWork(rendition: unknown): void {
  if (!rendition || typeof rendition !== 'object') return
  const queue = (rendition as { q?: EpubRenditionQueue }).q
  if (typeof queue?.stop === 'function') {
    queue.stop()
    return
  }
  queue?.clear?.()
}
