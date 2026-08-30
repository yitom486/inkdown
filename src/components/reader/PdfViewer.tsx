import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Minus, Plus } from 'lucide-react'
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from 'pdfjs-dist'
import { Button } from '@/components/ui/button'
import { PaneErrorBoundary } from '@/components/shared/PaneErrorBoundary'
import { AnnotationNoteDialog } from '@/components/reader/AnnotationNoteDialog'
import { PdfPageView } from '@/components/reader/PdfPageView'
import { ReaderContentShell } from '@/components/reader/ReaderContentShell'
import { ReaderFooterNav } from '@/components/reader/ReaderFooterNav'
import { ReaderToolbarShell } from '@/components/reader/ReaderToolbarShell'
import { ReadingMarkPopover } from '@/components/reader/ReadingMarkPopover'
import { SelectionToolbar } from '@/components/reader/SelectionToolbar'
import { useReaderBinary } from '@/hooks/reader/useReaderBinary'
import { useReadingMarkInspector } from '@/hooks/reader/useReadingMarkInspector'
import { registerReaderContent } from '@/lib/agent/context/reader-content-registry'
import { registerReaderMarks } from '@/lib/agent/context/reader-marks-registry'
import { registerSelectionProvider, commitReaderSelection, clearReaderSelection, readSelectionText } from '@/lib/agent/context/reader-selection-registry'
import { focusAgentComposerOnReaderSelection, openAgentComposerToAskSelection, addSelectionMarkerToComposer } from '@/lib/agent/context/focus-agent-composer'
import { DEFAULT_HIGHLIGHT_COLOR } from '@/lib/reader/reading-mark-colors'
import { useReadingMarks } from '@/hooks/reader/useReadingMarks'
import { loadPdfOutlineUnits } from '@/lib/reader/pdf-outline'
import {
  estimatePageOffsetTop,
  PDF_PAGE_GAP_PX,
  scalePdfPageCssSize,
  type PdfPageCssSize,
} from '@/lib/reader/pdf-page-metrics'
import { openPdfDocument } from '@/lib/reader/pdf-document'
import { findPdfMarksAtPoint } from '@/lib/reader/pdf-reading-marks'
import { shouldRenderPdfPage } from '@/lib/reader/pdf-render'
import { findMarkForSelection, isClickNotDrag } from '@/lib/reader/reading-mark-hit'
import type { ReaderUnit } from '@/lib/reader/reader-navigation'
import {
  copyTextToClipboard,
  getSelectionToolbarPosition,
  readPdfSelection,
  type PdfSelectionSnapshot,
} from '@/lib/reader/pdf-selection'
import {
  bindDocumentSelectionCollapse,
  bindOutsideReaderPointerDismiss,
  clearWindowSelection,
} from '@/lib/reader/reader-selection-dismiss'
import { buildReadingFileFingerprint } from '@/lib/reader/reading-file-fingerprint'
import { reportAppError } from '@/lib/workspace/report-error'
import { tocFromPdfPages, resolvePdfPageChapter } from '@/lib/reader/export-reading-notes'
import { useReadingProgressStore } from '@/stores/reading-progress-store'
import { useReaderNavigationStore, useReaderNavTitles } from '@/stores/reader-navigation-store'
import type { AppError } from '@shared/core/errors'
import type { ReadingMark } from '@shared/types/reading-mark'
import { isOk } from '@shared/core/result'
import { toast } from 'sonner'
import '@/styles/pdf-viewer.css'

interface PdfViewerProps {
  filePath: string
  theme: 'dark' | 'light'
}

export function PdfViewer({ filePath, theme }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pageAnchorRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null)
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null)
  const ignoreScrollSyncRef = useRef(false)
  const pendingJumpPageRef = useRef<number | null>(null)
  const pageNumRef = useRef(1)
  const savePdfProgressTimerRef = useRef<number | null>(null)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.2)
  const [pageCssSize, setPageCssSize] = useState<PdfPageCssSize>({ width: 612, height: 792 })
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [tocOpen, setTocOpen] = useState(false)
  const [marksOpen, setMarksOpen] = useState(false)
  const [outlineUnits, setOutlineUnits] = useState<ReaderUnit[]>([])
  const [selectionSnapshot, setSelectionSnapshot] = useState<PdfSelectionSnapshot | null>(null)
  const [selectionToolbarPos, setSelectionToolbarPos] = useState<{ x: number; y: number } | null>(
    null,
  )
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [editingNoteMark, setEditingNoteMark] = useState<ReadingMark | null>(null)
  const pointerOriginRef = useRef<{ x: number; y: number } | null>(null)

  const { data, isLoading, error } = useReaderBinary(filePath)
  const { marks, createMark, updateMark, deleteMark } = useReadingMarks(filePath)
  const inspector = useReadingMarkInspector(marks)
  const inspectorRef = useRef(inspector)
  inspectorRef.current = inspector

  const clearTextSelection = useCallback(() => {
    setSelectionSnapshot(null)
    setSelectionToolbarPos(null)
    clearReaderSelection()
    clearWindowSelection(window)
  }, [])

  const dimTextSelection = useCallback(() => {
    setSelectionToolbarPos(null)
    clearWindowSelection(window)
    inspectorRef.current.close()
  }, [])

  const fileFingerprint = data
    ? buildReadingFileFingerprint(filePath, data.data.byteLength)
    : ''

  const ready = numPages > 0 && pdfDoc !== null

  const nav = useReaderNavigationStore((state) => state.nav)
  const { currentUnitId } = useReaderNavTitles()

  useEffect(() => {
    useReaderNavigationStore.getState().beginSession(filePath, 'pdf')
    return () => {
      useReaderNavigationStore.getState().beginSession('', 'pdf')
    }
  }, [filePath])

  useEffect(() => {
    if (outlineUnits.length === 0) return
    useReaderNavigationStore.getState().setUnits(outlineUnits)
    useReaderNavigationStore.getState().syncPdf(outlineUnits, pageNum)
  }, [outlineUnits, pageNum])

  useEffect(() => {
    if (ready) {
      useReaderNavigationStore.getState().setReady(true)
    }
  }, [ready])

  const pageNumbers = useMemo(
    () => Array.from({ length: numPages }, (_, index) => index + 1),
    [numPages],
  )

  useEffect(() => {
    if (error && typeof error === 'object' && error !== null && 'code' in error) {
      reportAppError(error as AppError)
    }
  }, [error])

  useEffect(() => {
    if (!data) return

    let cancelled = false
    pdfDocRef.current = null
    loadingTaskRef.current = null
    setPdfDoc(null)
    setPageNum(1)
    setNumPages(0)
    setOutlineUnits([])
    setTocOpen(false)
    pageAnchorRefs.current.clear()

    void (async () => {
      try {
        const loadingTask = openPdfDocument({ data: data.data.slice() })
        loadingTaskRef.current = loadingTask
        const pdf = await loadingTask.promise
        if (cancelled) {
          void loadingTask.destroy()
          return
        }

        pdfDocRef.current = pdf
        setPdfDoc(pdf)
        setNumPages(pdf.numPages)

        const savedProgress = useReadingProgressStore.getState().getPdfProgress(filePath)
        const restoredPage =
          savedProgress?.pageNum &&
          savedProgress.pageNum >= 1 &&
          savedProgress.pageNum <= pdf.numPages
            ? savedProgress.pageNum
            : 1
        pageNumRef.current = restoredPage
        if (restoredPage > 1) {
          pendingJumpPageRef.current = restoredPage
        }
        setPageNum(restoredPage)

        const firstPage = await pdf.getPage(1)
        if (!cancelled) {
          const viewport = firstPage.getViewport({ scale: 1 })
          setPageCssSize({ width: viewport.width, height: viewport.height })
        }

        const units = await loadPdfOutlineUnits(pdf)
        if (!cancelled) setOutlineUnits(units)
      } catch (cause) {
        if (!cancelled) {
          reportAppError({
            code: 'FILE_READ_ERROR',
            message: cause instanceof Error ? cause.message : 'PDF 加载失败',
          })
        }
      }
    })()

    return () => {
      cancelled = true
      if (pageNumRef.current >= 1) {
        useReadingProgressStore.getState().savePdfProgress(filePath, {
          pageNum: pageNumRef.current,
        })
      }
      void loadingTaskRef.current?.destroy()
      pdfDocRef.current = null
      loadingTaskRef.current = null
      setPdfDoc(null)
    }
  }, [data, filePath])

  useEffect(() => {
    pageNumRef.current = pageNum
  }, [pageNum])

  const readPageText = useCallback(async (page: number): Promise<string> => {
    const pdf = pdfDocRef.current
    if (!pdf) return ''
    // 走 getTextContent 而非 textLayer DOM：未渲染的页也能取到
    const content = await (await pdf.getPage(page)).getTextContent()
    return content.items.map((item) => ('str' in item ? item.str : '')).join('')
  }, [])

  useEffect(() => {
    return registerReaderContent({
      filePath,
      getCurrentText: () => readPageText(pageNumRef.current),
      // PDF 一页 ≈ 视口；多页同时露边时仍以当前页为主
      getViewportText: () => readPageText(pageNumRef.current),
      iterateUnits: async function* () {
        const total = pdfDocRef.current?.numPages ?? 0
        for (let page = 1; page <= total; page += 1) {
          yield { label: `第 ${page} 页`, text: await readPageText(page) }
        }
      },
      getUnitByIndex: async (flatIndex) => {
        const units = useReaderNavigationStore.getState().units
        const unit = units[flatIndex]
        if (!unit) return null
        const page = Number.parseInt('href' in unit ? unit.href : '', 10)
        if (!Number.isFinite(page) || page < 1) {
          // 无页码时退回按目录标签在全文页里搜不到——直接读不到
          return null
        }
        const text = await readPageText(page)
        if (!text.trim()) return null
        return { label: unit.label || `第 ${page} 页`, text }
      },
    })
  }, [filePath, readPageText])

  useEffect(() => {
    return registerSelectionProvider({
      filePath,
      getSelectionText: () => readSelectionText(filePath),
    })
  }, [filePath])

  useEffect(() => {
    if (!ready || pageNum < 1) return

    if (savePdfProgressTimerRef.current !== null) {
      window.clearTimeout(savePdfProgressTimerRef.current)
    }
    savePdfProgressTimerRef.current = window.setTimeout(() => {
      savePdfProgressTimerRef.current = null
      useReadingProgressStore.getState().savePdfProgress(filePath, { pageNum })
    }, 400)

    return () => {
      if (savePdfProgressTimerRef.current !== null) {
        window.clearTimeout(savePdfProgressTimerRef.current)
      }
    }
  }, [filePath, pageNum, ready])

  const fitWidth = useCallback(() => {
    const pdf = pdfDocRef.current
    const container = containerRef.current
    if (!pdf || !container) return

    void (async () => {
      const page = await pdf.getPage(1)
      const viewport = page.getViewport({ scale: 1 })
      const nextScale = Math.max(0.5, (container.clientWidth - 48) / viewport.width)
      setScale(Number(nextScale.toFixed(2)))
      setPageCssSize({ width: viewport.width, height: viewport.height })
    })()
  }, [])

  useEffect(() => {
    fitWidth()
  }, [fitWidth, filePath, numPages])

  useEffect(() => {
    setSelectionSnapshot(null)
    setSelectionToolbarPos(null)
    clearReaderSelection()
  }, [filePath])

  useEffect(() => {
    return bindDocumentSelectionCollapse(document, window, () => {
      setSelectionToolbarPos(null)
    })
  }, [])

  useEffect(() => {
    return bindOutsideReaderPointerDismiss((target) => {
      const container = containerRef.current
      if (!container) return false
      return container.contains(target)
    }, dimTextSelection)
  }, [dimTextSelection])

  useEffect(() => {
    return () => {
      clearReaderSelection()
    }
  }, [filePath])

  const scaledPageSize = useMemo(
    () => scalePdfPageCssSize(pageCssSize, scale),
    [pageCssSize, scale],
  )

  const applyScrollToPage = useCallback(
    (targetPage: number, behavior: ScrollBehavior = 'auto') => {
      const container = containerRef.current
      if (!container) return

      ignoreScrollSyncRef.current = true
      const anchor = pageAnchorRefs.current.get(targetPage)
      const estimatedTop = estimatePageOffsetTop(targetPage, scaledPageSize.height, PDF_PAGE_GAP_PX)
      const top = anchor ? Math.max(0, anchor.offsetTop - 16) : estimatedTop

      if (behavior === 'auto') {
        container.scrollTop = top
      } else {
        container.scrollTo({ top, behavior })
      }

      window.setTimeout(() => {
        ignoreScrollSyncRef.current = false
      }, behavior === 'smooth' ? 420 : 80)
    },
    [scaledPageSize.height],
  )

  const scrollToPage = useCallback(
    (targetPage: number, behavior: ScrollBehavior = 'smooth') => {
      setPageNum(targetPage)
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          applyScrollToPage(targetPage, behavior)
        })
      })
    },
    [applyScrollToPage],
  )

  /** 跨页导航：目录、书签、节标题 — 先更新渲染窗口，再 instant 跳转 */
  const jumpToPage = useCallback((targetPage: number) => {
    pendingJumpPageRef.current = targetPage
    setPageNum(targetPage)
  }, [])

  const goToFlatIndex = useCallback(
    (flatIndex: number) => {
      const unit = outlineUnits[flatIndex]
      if (!unit) return
      useReaderNavigationStore.getState().syncFlatIndex(flatIndex)
      const nextPage = Number.parseInt(unit.href, 10)
      if (Number.isFinite(nextPage) && nextPage >= 1) {
        jumpToPage(nextPage)
      }
    },
    [jumpToPage, outlineUnits],
  )

  const goToUnit = useCallback(
    (unit: ReaderUnit) => {
      const flatIndex = outlineUnits.findIndex(
        (item) => item.href === unit.href && item.label === unit.label,
      )
      if (flatIndex >= 0) {
        goToFlatIndex(flatIndex)
        return
      }
      const nextPage = Number.parseInt(unit.href, 10)
      if (Number.isFinite(nextPage) && nextPage >= 1) {
        jumpToPage(nextPage)
      }
    },
    [goToFlatIndex, jumpToPage, outlineUnits],
  )

  useLayoutEffect(() => {
    const targetPage = pendingJumpPageRef.current
    if (targetPage === null) return

    applyScrollToPage(targetPage, 'auto')
    pendingJumpPageRef.current = null

    // 目标页渲染完成后用真实高度再校准一次
    window.requestAnimationFrame(() => {
      applyScrollToPage(targetPage, 'auto')
    })
  }, [applyScrollToPage, pageNum, scaledPageSize.height, scale])

  useEffect(() => {
    const container = containerRef.current
    if (!container || numPages === 0) return

    const updateCurrentPage = () => {
      if (ignoreScrollSyncRef.current) return

      const midpoint = container.scrollTop + container.clientHeight * 0.35
      let closestPage = 1
      let closestDistance = Number.POSITIVE_INFINITY

      for (const [page, element] of pageAnchorRefs.current) {
        const center = element.offsetTop + element.offsetHeight / 2
        const distance = Math.abs(center - midpoint)
        if (distance < closestDistance) {
          closestDistance = distance
          closestPage = page
        }
      }

      setPageNum((current) => (current === closestPage ? current : closestPage))
    }

    updateCurrentPage()
    container.addEventListener('scroll', updateCurrentPage, { passive: true })
    return () => container.removeEventListener('scroll', updateCurrentPage)
  }, [numPages, scale])

  const goPrev = useCallback(() => {
    scrollToPage(Math.max(1, pageNum - 1), 'smooth')
  }, [pageNum, scrollToPage])

  const goNext = useCallback(() => {
    scrollToPage(Math.min(numPages, pageNum + 1), 'smooth')
  }, [numPages, pageNum, scrollToPage])

  const handlePageMouseUp = useCallback((
    pageNumber: number,
    pageElement: HTMLElement,
    point: { clientX: number; clientY: number },
  ) => {
    window.setTimeout(() => {
      if (isClickNotDrag(pointerOriginRef.current, point)) {
        const hits = findPdfMarksAtPoint(
          marks,
          pageNumber,
          point.clientX,
          point.clientY,
          pageElement,
        )
        if (hits.length > 0) {
          clearWindowSelection(window)
          setSelectionToolbarPos(null)
          inspector.openAt(hits, point.clientX, point.clientY)
          return
        }
      }

      const snapshot = readPdfSelection(pageElement, pageNumber)
      if (!snapshot) {
        if (isClickNotDrag(pointerOriginRef.current, point)) {
          inspector.close()
        }
        return
      }

      inspector.close()
      setSelectionSnapshot(snapshot)
      commitReaderSelection(filePath, snapshot.text)
      focusAgentComposerOnReaderSelection()
      setSelectionToolbarPos(getSelectionToolbarPosition(snapshot))
    }, 10)
  }, [filePath, inspector, marks])

  const selectionSnapshotRef = useRef(selectionSnapshot)
  selectionSnapshotRef.current = selectionSnapshot

  const addPageBookmark = useCallback(async () => {
    if (!fileFingerprint || numPages === 0) {
      throw new Error('无法获取当前页')
    }
    const result = await createMark({
      filePath,
      fileFingerprint,
      kind: 'bookmark',
      anchor: { format: 'pdf', page: pageNum },
      label: nav.current?.label ?? `第 ${pageNum} 页`,
    })
    if (!isOk(result)) {
      throw new Error(result.error.message || '创建书签失败')
    }
    toast.success('已添加书签')
    return result.value
  }, [createMark, fileFingerprint, filePath, nav.current?.label, numPages, pageNum])

  const handleSaveAnnotation = useCallback(
    async (note: string, color = DEFAULT_HIGHLIGHT_COLOR) => {
      const snapshot = selectionSnapshotRef.current
      if (!snapshot || !fileFingerprint) {
        throw new Error('当前没有可用选区，请先划选文本')
      }

      const existing = findMarkForSelection(marks, {
        format: 'pdf',
        text: snapshot.text,
        page: snapshot.page,
      })
      if (existing) {
        const trimmed = note.trim()
        const result = await updateMark({
          id: existing.id,
          color,
          ...(trimmed
            ? {
                note: trimmed,
                kind: existing.kind === 'highlight' ? ('highlight' as const) : ('note' as const),
              }
            : {}),
        })
        if (!isOk(result)) {
          throw new Error(result.error.message || '更新标记失败')
        }
        toast.success(trimmed ? '已保存批注' : '已更新高亮')
        clearTextSelection()
        return result.value
      }

      const result = await createMark({
        filePath,
        fileFingerprint,
        kind: note ? 'note' : 'highlight',
        anchor: {
          format: 'pdf',
          page: snapshot.page,
          selectedText: snapshot.text,
          rects: snapshot.rects,
        },
        excerpt: snapshot.text,
        note: note || undefined,
        color,
      })

      if (!isOk(result)) {
        throw new Error(result.error.message || '创建批注失败')
      }

      toast.success(note ? '已保存批注' : '已添加高亮')
      clearTextSelection()
      return result.value
    },
    [clearTextSelection, createMark, fileFingerprint, filePath, marks, updateMark],
  )

  useEffect(() => {
    return registerReaderMarks({
      filePath,
      createBookmark: () => addPageBookmark(),
      createNoteFromSelection: (note) => handleSaveAnnotation(note),
    })
  }, [addPageBookmark, filePath, handleSaveAnnotation])

  const handleSelectMark = useCallback(
    (mark: ReadingMark) => {
      if (mark.anchor.format === 'pdf') {
        jumpToPage(mark.anchor.page)
      }
    },
    [jumpToPage],
  )

  const handleDeleteMark = useCallback(
    async (mark: ReadingMark) => {
      await deleteMark(mark.id)
      toast.success('已删除')
    },
    [deleteMark],
  )

  const estimatedPageHeight = Math.max(120, scaledPageSize.height)
  const estimatedPageWidth = Math.max(120, scaledPageSize.width)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ReaderToolbarShell
        ready={ready}
        tocDisabled={outlineUnits.length === 0}
        onTocToggle={() => {
          setMarksOpen(false)
          setTocOpen((value) => !value)
        }}
        onMarksToggle={() => {
          setTocOpen(false)
          setMarksOpen((value) => !value)
        }}
        onAddBookmark={() => void addPageBookmark()}
        center={
          <>
            <Button variant="ghost" size="icon-sm" disabled={pageNum <= 1} onClick={goPrev}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-24 text-center text-sm text-muted-foreground">
              {numPages > 0 ? `${pageNum} / ${numPages}` : '—'}
            </span>
            <Button variant="ghost" size="icon-sm" disabled={pageNum >= numPages} onClick={goNext}>
              <ChevronRight className="size-4" />
            </Button>
            <div className="mx-2 h-4 w-px bg-border/60" />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setScale((value) => Math.max(0.5, value - 0.1))}
            >
              <Minus className="size-4" />
            </Button>
            <span className="w-12 text-center text-xs text-muted-foreground">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setScale((value) => Math.min(3, value + 0.1))}
            >
              <Plus className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" className="ml-1 h-7 text-xs" onClick={fitWidth}>
              适合宽度
            </Button>
          </>
        }
        trailing={isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
      />

      <ReaderContentShell
        marksOpen={marksOpen}
        marks={marks}
        onSelectMark={handleSelectMark}
        onDeleteMark={(mark) => void handleDeleteMark(mark)}
        onCloseMarks={() => setMarksOpen(false)}
        onExportNotes={() => {
          toast.message('PDF 笔记导出即将支持')
        }}
        marksToc={tocFromPdfPages(marks)}
        marksCurrentChapterKey={`page-${pageNum}`}
        marksResolveChapter={resolvePdfPageChapter}
        tocOpen={tocOpen}
        units={outlineUnits}
        currentUnitId={currentUnitId ?? String(pageNum)}
        onCloseToc={() => setTocOpen(false)}
        onSelectUnit={(unit) => {
          goToUnit(unit)
          setTocOpen(false)
        }}
      >
        <div
          ref={containerRef}
          className={`h-full min-h-0 overflow-auto ${theme === 'dark' ? 'bg-zinc-900' : 'bg-zinc-100'}`}
        >
          <PaneErrorBoundary name="PDF 阅读" filePath={filePath}>
            {isLoading || !pdfDoc ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                正在加载 PDF…
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-full flex-col items-center gap-4 px-4 py-4">
                {pageNumbers.map((page) => {
                  const active = shouldRenderPdfPage(page, pageNum, numPages)
                  return (
                    <div
                      key={page}
                      ref={(node) => {
                        if (node) pageAnchorRefs.current.set(page, node)
                        else pageAnchorRefs.current.delete(page)
                      }}
                      className="w-fit max-w-full"
                      style={{ minHeight: active ? undefined : estimatedPageHeight }}
                      data-page={page}
                    >
                      {active ? (
                        <PdfPageView
                          pdf={pdfDoc}
                          pageNumber={page}
                          scale={scale}
                          theme={theme}
                          marks={marks}
                          onMouseUp={handlePageMouseUp}
                          onPointerOrigin={(x, y) => {
                            pointerOriginRef.current = { x, y }
                          }}
                        />
                      ) : (
                        <div
                          className="rounded-sm bg-white/80 shadow-md dark:bg-zinc-800/80"
                          style={{
                            width: estimatedPageWidth,
                            height: estimatedPageHeight,
                          }}
                          aria-hidden
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </PaneErrorBoundary>
        </div>
      </ReaderContentShell>

      <ReaderFooterNav
        ready={ready}
        onPrevious={() => nav.previousIndex >= 0 && goToFlatIndex(nav.previousIndex)}
        onNext={() => nav.nextIndex >= 0 && goToFlatIndex(nav.nextIndex)}
      />

      {inspector.pos && inspector.active ? (
        <ReadingMarkPopover
          mark={inspector.active}
          stack={inspector.stack}
          x={inspector.pos.x}
          y={inspector.pos.y}
          onSelect={inspector.select}
          onChangeColor={(color) => {
            void updateMark({ id: inspector.active!.id, color })
          }}
          onEditNote={() => {
            setEditingNoteMark(inspector.active)
            setNoteDialogOpen(true)
            inspector.close()
          }}
          onDelete={() => {
            void handleDeleteMark(inspector.active!).then(() => inspector.close())
          }}
        />
      ) : null}

      {selectionToolbarPos && selectionSnapshot ? (
        <SelectionToolbar
          x={selectionToolbarPos.x}
          y={selectionToolbarPos.y}
          readOnly
          onCopy={() => {
            void copyTextToClipboard(selectionSnapshot.text).then((ok) => {
              if (ok) toast.success('已复制')
            })
            dimTextSelection()
          }}
          onAnnotate={() => {
            setEditingNoteMark(null)
            setNoteDialogOpen(true)
            setSelectionToolbarPos(null)
          }}
          onHighlight={(color) => {
            void handleSaveAnnotation('', color)
          }}
          onAddToChat={() => {
            addSelectionMarkerToComposer()
            dimTextSelection()
          }}
          onAskAgent={() => {
            openAgentComposerToAskSelection()
            dimTextSelection()
          }}
          onDismiss={clearTextSelection}
        />
      ) : null}

      <AnnotationNoteDialog
        open={noteDialogOpen}
        excerpt={editingNoteMark?.excerpt ?? selectionSnapshot?.text}
        initialNote={editingNoteMark?.note ?? ''}
        title={editingNoteMark ? '编辑批注' : '添加批注'}
        onOpenChange={(open) => {
          setNoteDialogOpen(open)
          if (!open) setEditingNoteMark(null)
        }}
        onSave={(note) => {
          if (editingNoteMark) {
            void updateMark({
              id: editingNoteMark.id,
              note,
              kind: editingNoteMark.kind === 'highlight' ? 'highlight' : 'note',
            }).then((result) => {
              if (isOk(result)) toast.success(note.trim() ? '已保存批注' : '已清除批注')
            })
            return
          }
          void handleSaveAnnotation(note)
        }}
      />
    </div>
  )
}
