/**
 * pdf.js TextLayerBuilder 中与选区相关的最小逻辑。
 * 缺少 endOfContent + selecting 时，拖选无法延伸到行末，表现为每行只能选中一段固定宽度。
 */

const textLayerRegistry = new Map<HTMLElement, HTMLElement>()
let globalListenerAttached = false
let prevRange: Range | null = null

function resetEndOfContent(endDiv: HTMLElement, textLayerDiv: HTMLElement): void {
  textLayerDiv.append(endDiv)
  endDiv.style.width = ''
  endDiv.style.height = ''
  endDiv.style.userSelect = ''
  textLayerDiv.classList.remove('selecting')
}

function attachGlobalSelectionListener(): void {
  if (globalListenerAttached) return
  globalListenerAttached = true

  let isPointerDown = false

  document.addEventListener('pointerdown', () => {
    isPointerDown = true
  })
  document.addEventListener('pointerup', () => {
    isPointerDown = false
    for (const [textLayerDiv, endDiv] of textLayerRegistry) {
      resetEndOfContent(endDiv, textLayerDiv)
    }
  })
  window.addEventListener('blur', () => {
    isPointerDown = false
    for (const [textLayerDiv, endDiv] of textLayerRegistry) {
      resetEndOfContent(endDiv, textLayerDiv)
    }
  })
  document.addEventListener('keyup', () => {
    if (!isPointerDown) {
      for (const [textLayerDiv, endDiv] of textLayerRegistry) {
        resetEndOfContent(endDiv, textLayerDiv)
      }
    }
  })

  document.addEventListener('selectionchange', () => {
    const selection = document.getSelection()
    if (!selection || selection.rangeCount === 0) {
      for (const [textLayerDiv, endDiv] of textLayerRegistry) {
        resetEndOfContent(endDiv, textLayerDiv)
      }
      return
    }

    const activeTextLayers = new Set<HTMLElement>()
    for (let index = 0; index < selection.rangeCount; index += 1) {
      const range = selection.getRangeAt(index)
      for (const textLayerDiv of textLayerRegistry.keys()) {
        if (!activeTextLayers.has(textLayerDiv) && range.intersectsNode(textLayerDiv)) {
          activeTextLayers.add(textLayerDiv)
        }
      }
    }

    for (const [textLayerDiv, endDiv] of textLayerRegistry) {
      if (activeTextLayers.has(textLayerDiv)) {
        textLayerDiv.classList.add('selecting')
      } else {
        resetEndOfContent(endDiv, textLayerDiv)
      }
    }

    const range = selection.getRangeAt(0)
    const modifyStart =
      prevRange !== null &&
      (range.compareBoundaryPoints(Range.END_TO_END, prevRange) === 0 ||
        range.compareBoundaryPoints(Range.START_TO_END, prevRange) === 0)

    let anchor: Node | null = modifyStart ? range.startContainer : range.endContainer
    if (anchor.nodeType === Node.TEXT_NODE) {
      anchor = anchor.parentNode
    }
    if (anchor instanceof HTMLElement && anchor.classList.contains('highlight')) {
      anchor = anchor.parentNode
    }

    if (!modifyStart && range.endOffset === 0 && anchor) {
      let cursor: Node | null = anchor
      while (cursor && cursor.nodeType === Node.ELEMENT_NODE) {
        const element = cursor as HTMLElement
        if (element.previousSibling) {
          cursor = element.previousSibling
          break
        }
        cursor = element.parentNode
      }
      while (cursor && cursor.nodeType === Node.ELEMENT_NODE && !(cursor as HTMLElement).childNodes.length) {
        cursor = (cursor as HTMLElement).previousSibling
      }
      if (cursor) anchor = cursor
    }

    const parentTextLayer =
      anchor instanceof HTMLElement ? anchor.closest<HTMLElement>('.textLayer') : null
    const endDiv = parentTextLayer ? textLayerRegistry.get(parentTextLayer) : undefined

    if (endDiv && parentTextLayer && anchor instanceof HTMLElement && anchor.parentElement) {
      endDiv.style.width = parentTextLayer.style.width
      endDiv.style.height = parentTextLayer.style.height
      endDiv.style.userSelect = 'text'
      anchor.parentElement.insertBefore(
        endDiv,
        modifyStart ? anchor : anchor.nextSibling,
      )
    }

    prevRange = range.cloneRange()
  })
}

export function setupPdfTextLayerSelection(textLayerDiv: HTMLElement): () => void {
  const endOfContent = document.createElement('div')
  endOfContent.className = 'endOfContent'
  textLayerDiv.append(endOfContent)
  textLayerRegistry.set(textLayerDiv, endOfContent)

  const onMouseDown = () => {
    textLayerDiv.classList.add('selecting')
  }
  textLayerDiv.addEventListener('mousedown', onMouseDown)

  attachGlobalSelectionListener()

  return () => {
    textLayerRegistry.delete(textLayerDiv)
    textLayerDiv.removeEventListener('mousedown', onMouseDown)
    endOfContent.remove()
    textLayerDiv.classList.remove('selecting')
  }
}

export function teardownPdfTextLayerSelectionRegistry(): void {
  textLayerRegistry.clear()
  prevRange = null
}
