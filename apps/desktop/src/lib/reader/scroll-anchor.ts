/**
 * 视口防抖锚点锁（preserveScrollAnchor）
 *
 * 解决用户在切换 HUD 停靠/悬浮、展开/收起目录大纲或卡轨时，由于主阅读区 DOM 宽度
 * 发生突变导致排版重排、视线聚焦文字被顶出视野的眩晕问题。
 * 在布局切换触发前记录黄金阅读区内锚点元素，并在 400ms CSS 过渡期内微距补偿滚动。
 */
export function preserveScrollAnchor(layoutChangeCallback: () => void): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    layoutChangeCallback()
    return
  }

  // 寻找有效阅读滚动容器：优先主阅读容器、CodeMirror 滚动层、PDF 视口容器或全局 document
  const container =
    document.getElementById('reading-text-canvas') ||
    document.querySelector('.cm-scroller') ||
    document.querySelector('.pdf-viewer-container') ||
    document.querySelector('[data-reading-viewport]') ||
    document.body

  if (!container) {
    layoutChangeCallback()
    return
  }

  // 1. 探针定位：在视口顶部 40px ~ 450px 寻找第一条有效正文元素
  const candidates = container.querySelectorAll(
    'h1, h2, h3, h4, p[data-anchor], p, pre, blockquote, .cm-line',
  )
  let anchorElement: HTMLElement | null = null
  let anchorTopOffset = 0

  const maxTop = Math.min(window.innerHeight * 0.6, 450)
  for (const el of Array.from(candidates)) {
    const rect = el.getBoundingClientRect()
    if (rect.top >= 40 && rect.top <= maxTop && rect.height > 8) {
      anchorElement = el as HTMLElement
      anchorTopOffset = rect.top
      break
    }
  }

  // 2. 执行导致布局变化的真实状态变更
  layoutChangeCallback()

  if (!anchorElement) return

  // 3. 连续微距补偿锁定（逐帧微调至物理偏移稳定）
  const startTime = performance.now()
  const duration = 400

  const keepAnchorStationary = () => {
    if (!anchorElement || !anchorElement.isConnected) return
    const currentRect = anchorElement.getBoundingClientRect()
    const diff = currentRect.top - anchorTopOffset

    // 只要位移偏差超过 0.5px 即刻瞬间补偿，消除肉眼跳动
    if (Math.abs(diff) > 0.5) {
      if (container !== document.body && 'scrollTop' in container) {
        container.scrollTop += diff
      } else {
        window.scrollBy({ top: diff, behavior: 'instant' })
      }
    }

    if (performance.now() - startTime < duration) {
      requestAnimationFrame(keepAnchorStationary)
    }
  }

  requestAnimationFrame(keepAnchorStationary)
}
