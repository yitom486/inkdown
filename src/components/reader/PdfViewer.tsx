import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Minus, Plus } from 'lucide-react'
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from 'pdfjs-dist'
import { Button } from '@/components/ui/button'
import { PaneErrorBoundary } from '@/components/shared/PaneErrorBoundary'
import { AnnotationNoteDialog } from '@/components/reader/AnnotationNoteDialog'
import { EpubMarkTooltip } from '@/components/reader/EpubMarkTooltip'
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
import { registerSelectionProvider, commitReaderSelection, clearReaderSelection } from '@/lib/agent/context/reader-selection-registry'
import { openAgentComposerToAskSelection, addSelectionMarkerToComposer } from '@/lib/agent/context/focus-agent-composer'
import { DEFAULT_HIGHLIGHT_COLOR } from '@/lib/reader/reading-mark-colors'
import { useReadingMarks } from '@/hooks/reader/useReadingMarks'
import { loadPdfOutlineInfo, formatPdfOutlineNotice, type PdfOutlineSource } from '@/lib/reader/pdf-outline'
import { detectPdfDocumentProfile } from '@/lib/reader/pdf-scan-detector'
import {
  clearPdfOcrCache,
  getPdfOcrPage,
  listPdfOcrPages,
  recognizePdfOcrPage,
  recognizePdfOcrToc,
  getPdfOcrToc,
  savePdfOcrToc,
} from '@/api/ocr-api'
import { buildPdfOcrTocCache, readerUnitsToOcrEntries } from '@/lib/reader/pdf-ocr-toc-cache'
import {
  pdfPageNeedsOcr,
  readPdfPageNativeText,
  textFromOcrPageCache,
  formatPdfPageTextForAgent,
  assertOcrCachePage,
} from '@/lib/reader/pdf-page-text'
import { PdfOcrBanner } from '@/components/reader/PdfOcrBanner'
import { PdfOcrTocEditor } from '@/components/reader/PdfOcrTocEditor'
import type { OcrTocEntry, PdfOcrPageCache } from '@shared/types/ocr'
import {
  PDF_JUMP_SYNC_HOLD_MS,
  PDF_PAGE_GAP_PX,
  resolvePdfPageScrollTop,
  scalePdfPageCssSize,
  type PdfPageCssSize,
} from '@/lib/reader/pdf-page-metrics'
import { openPdfDocument } from '@/lib/reader/pdf-document'
import { findPdfMarksAtPoint, findPdfNoteMarkAtPoint } from '@/lib/reader/pdf-reading-marks'
import { shouldRenderPdfPage } from '@/lib/reader/pdf-render'
import { findMarkForSelection, isClickNotDrag } from '@/lib/reader/reading-mark-hit'
import type { ReaderUnit } from '@/lib/reader/reader-navigation'
import {
  copyTextToClipboard,
  getSelectionToolbarPosition,
  readPdfSelection,
  buildPdfSnapshotFromRange,
  type PdfSelectionSnapshot,
} from '@/lib/reader/pdf-selection'
import { findTextRangeInRoot } from '@/lib/reader/excerpt-text-match'
import { waitForDom } from '@/lib/reader/wait-for-dom'
import type { CreateMarkAtParams } from '@/lib/agent/context/reader-marks-registry'
import {
  bindDocumentSelectionCollapse,
  bindOutsideReaderPointerDismiss,
  clearWindowSelection,
} from '@/lib/reader/reader-selection-dismiss'
import { buildReadingFileFingerprint } from '@/lib/reader/reading-file-fingerprint'
import { reportAppError } from '@/lib/workspace/report-error'
import {
  resolvePdfChapter,
  resolvePdfChapterByPage,
  tocFromPdfUnits,
  type ReadingNotesContentKind,
  type ReadingNotesScope,
} from '@/lib/reader/export-reading-notes'
import { saveReadingNotesExport } from '@/lib/reader/save-reading-notes-export'
import { saveAnkiCardsExport } from '@/lib/reader/export-anki-cards'
import { resolvePdfOcrPrefetchPages } from '@/lib/reader/pdf-ocr-prefetch'
import { useAppSettingsStore } from '@/stores/app-settings-store'
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
  const jumpSettleCancelRef = useRef<(() => void) | null>(null)
  const scrollSyncReleaseTimerRef = useRef<number | null>(null)
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
  const [outlineSource, setOutlineSource] = useState<PdfOutlineSource | 'ocr'>('page-fallback')
  const [outlineNotice, setOutlineNotice] = useState<string | undefined>()
  const [isScannedPdf, setIsScannedPdf] = useState(false)
  const [ocrBannerDismissed, setOcrBannerDismissed] = useState(false)
  const [ocrTocEditorOpen, setOcrTocEditorOpen] = useState(false)
  const [ocrTocEditMode, setOcrTocEditMode] = useState(false)
  const [ocrTocEntries, setOcrTocEntries] = useState<OcrTocEntry[]>([])
  const [ocrTocSaving, setOcrTocSaving] = useState(false)
  const [ocrRecognizing, setOcrRecognizing] = useState(false)
  const [tocPageFrom, setTocPageFrom] = useState(8)
  const [tocPageTo, setTocPageTo] = useState(12)
  const [tocPageOffset, setTocPageOffset] = useState(12)
  const [ocrPageCaches, setOcrPageCaches] = useState<Record<number, PdfOcrPageCache>>({})
  const [ocrPageRecognizing, setOcrPageRecognizing] = useState<number | null>(null)
  const [ocrPagesInFlight, setOcrPagesInFlight] = useState<ReadonlySet<number>>(() => new Set())
  const [selectionSnapshot, setSelectionSnapshot] = useState<PdfSelectionSnapshot | null>(null)
  const [selectionToolbarPos, setSelectionToolbarPos] = useState<{ x: number; y: number } | null>(
    null,
  )
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [editingNoteMark, setEditingNoteMark] = useState<ReadingMark | null>(null)
  const [hoveredMark, setHoveredMark] = useState<ReadingMark | null>(null)
  const [markTooltipPos, setMarkTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const pointerOriginRef = useRef<{ x: number; y: number } | null>(null)
  /** mouseup 后提交的选区事务；后续 UI 不再依赖原生 Selection。 */
  const selectionTransactionRef = useRef<PdfSelectionSnapshot | null>(null)

  const { data, isLoading, error } = useReaderBinary(filePath)
  const { marks, createMark, updateMark, deleteMark } = useReadingMarks(filePath)
  const inspector = useReadingMarkInspector(marks)
  const inspectorRef = useRef(inspector)
  inspectorRef.current = inspector

  const clearTextSelection = useCallback(() => {
    selectionTransactionRef.current = null
    setSelectionSnapshot(null)
    setSelectionToolbarPos(null)
    clearReaderSelection()
    clearWindowSelection(window)
  }, [])

  const dimTextSelection = useCallback(() => {
    clearTextSelection()
    inspectorRef.current.close()
  }, [clearTextSelection])

  const captureSelectionSnapshot = useCallback((snapshot: PdfSelectionSnapshot) => {
    selectionTransactionRef.current = snapshot
    setSelectionSnapshot(snapshot)
    commitReaderSelection(filePath, snapshot.text)
    setSelectionToolbarPos(getSelectionToolbarPosition(snapshot))
    // 原生 Selection 在此结束生命周期；SVG 临时选区接管视觉状态。
    clearWindowSelection(window)
  }, [filePath])

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
    setOutlineSource('page-fallback')
    setOutlineNotice(undefined)
    setIsScannedPdf(false)
    setOcrBannerDismissed(false)
    setOcrTocEditorOpen(false)
    setOcrTocEditMode(false)
    setOcrTocEntries([])
    setOcrTocSaving(false)
    setOcrRecognizing(false)
    setOcrPageCaches({})
    setOcrPageRecognizing(null)
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

        const units = await loadPdfOutlineInfo(pdf)
        const profile = await detectPdfDocumentProfile(pdf)
        if (!cancelled) {
          setIsScannedPdf(profile.isScanned)
        }

        let nextUnits = units.units
        let nextSource: PdfOutlineSource | 'ocr' = units.source
        let nextNotice = formatPdfOutlineNotice(units, profile.isScanned)

        if (units.source === 'page-fallback' && profile.isScanned && fileFingerprint) {
          const cacheResult = await getPdfOcrToc({ fileFingerprint })
          if (cacheResult.ok && cacheResult.value.units.length > 0) {
            nextUnits = cacheResult.value.units
            nextSource = 'ocr'
            setTocPageFrom(cacheResult.value.tocPageRange[0])
            setTocPageTo(cacheResult.value.tocPageRange[1])
            setTocPageOffset(cacheResult.value.pageOffset)
            setOcrTocEntries(cacheResult.value.entries)
            nextNotice = undefined
          }
        }

        if (!cancelled) {
          setOutlineUnits(nextUnits)
          setOutlineSource(nextSource)
          setOutlineNotice(nextNotice)
        }

        if (profile.isScanned && fileFingerprint) {
          const pagesResult = await listPdfOcrPages({ fileFingerprint })
          if (!cancelled && pagesResult.ok && pagesResult.value.length > 0) {
            const entries = await Promise.all(
              pagesResult.value.map(async (pageNumber) => {
                const pageResult = await getPdfOcrPage({ fileFingerprint, page: pageNumber })
                if (!pageResult.ok || pageResult.value.page !== pageNumber) return null
                return [pageNumber, pageResult.value] as const
              }),
            )
            if (!cancelled) {
              setOcrPageCaches(Object.fromEntries(entries.filter((item) => item !== null)))
            }
          }
        }
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
  }, [data, filePath, fileFingerprint])

  const hasChapterToc = outlineSource === 'embedded' || outlineSource === 'ocr'
  const pdfOcrScale = useAppSettingsStore((state) => state.pdfOcrScale)

  const handleRecognizeToc = useCallback(async () => {
    if (!fileFingerprint || ocrRecognizing) return
    setOcrRecognizing(true)
    try {
      const result = await recognizePdfOcrToc({
        filePath,
        fileFingerprint,
        fromPage: Math.min(tocPageFrom, tocPageTo),
        toPage: Math.max(tocPageFrom, tocPageTo),
        pageOffset: tocPageOffset,
        scale: pdfOcrScale,
      })
      if (result.ok) {
        setOutlineUnits(result.value.units)
        setOutlineSource('ocr')
        setOcrTocEntries(result.value.entries)
        setTocOpen(true)
        setOcrTocEditorOpen(false)
        toast.success(`已识别 ${result.value.units.length} 条目录`)
      } else {
        toast.error(result.error.message)
      }
    } finally {
      setOcrRecognizing(false)
    }
  }, [fileFingerprint, filePath, ocrRecognizing, tocPageFrom, tocPageTo, tocPageOffset, pdfOcrScale])

  const handleSaveOcrToc = useCallback(
    async (entries: OcrTocEntry[]) => {
      if (!fileFingerprint) return
      setOcrTocSaving(true)
      try {
        const cache = buildPdfOcrTocCache({
          fileFingerprint,
          tocPageRange: [Math.min(tocPageFrom, tocPageTo), Math.max(tocPageFrom, tocPageTo)],
          pageOffset: tocPageOffset,
          entries,
        })
        if (cache.entries.length === 0) {
          toast.error('至少保留一条有效目录')
          return
        }
        const result = await savePdfOcrToc({ cache })
        if (!result.ok) {
          toast.error(result.error.message)
          return
        }
        setOcrTocEntries(cache.entries)
        setOutlineUnits(cache.units)
        setOcrTocEditMode(false)
        toast.success('目录已保存')
      } finally {
        setOcrTocSaving(false)
      }
    },
    [fileFingerprint, tocPageFrom, tocPageTo, tocPageOffset],
  )

  const handleOpenOcrTocEditor = useCallback(() => {
    setOcrTocEntries((prev) => {
      if (prev.length > 0) return prev
      if (outlineUnits.length === 0) return prev
      return readerUnitsToOcrEntries(
        outlineUnits.map((unit) => ({
          label: unit.label,
          href: unit.href,
          level: unit.level,
        })),
        tocPageOffset,
      )
    })
    setOcrTocEditMode(true)
    setTocOpen(true)
  }, [outlineUnits, tocPageOffset])

  useEffect(() => {
    if (outlineSource === 'ocr') return
    setTocPageOffset(tocPageTo)
  }, [outlineSource, tocPageTo])

  const showOcrBanner =
    (isScannedPdf && outlineSource === 'page-fallback' && !ocrBannerDismissed) ||
    ocrRecognizing ||
    (isScannedPdf && ocrTocEditorOpen)

  const currentPageOcrReady = Boolean(ocrPageCaches[pageNum]?.words.length)
  const currentPageOcrBusy =
    ocrPageRecognizing === pageNum || ocrPagesInFlight.has(pageNum)

  const ocrPagePendingRef = useRef<Map<number, Promise<string>>>(new Map())
  const ocrPageCachesRef = useRef(ocrPageCaches)
  const pdfOcrBackgroundPrefetch = useAppSettingsStore((state) => state.pdfOcrBackgroundPrefetch)

  useEffect(() => {
    ocrPageCachesRef.current = ocrPageCaches
  }, [ocrPageCaches])

  const ocrRecognizedCount = useMemo(
    () => Object.values(ocrPageCaches).filter((cache) => cache.words.length > 0).length,
    [ocrPageCaches],
  )

  const handleClearOcrCache = useCallback(async () => {
    if (!fileFingerprint) return
    if (!window.confirm('将清除本书已识别的正文页与目录缓存，是否继续？')) return

    const result = await clearPdfOcrCache({ fileFingerprint })
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }

    setOcrPageCaches({})
    ocrPagePendingRef.current.clear()
    setOcrPagesInFlight(new Set())

    if (outlineSource === 'ocr' && pdfDocRef.current) {
      const units = await loadPdfOutlineInfo(pdfDocRef.current)
      setOutlineUnits(units.units)
      setOutlineSource(units.source)
      setOutlineNotice(formatPdfOutlineNotice(units, isScannedPdf))
    }

    setOcrTocEntries([])
    setOcrTocEditMode(false)
    setOcrTocEditorOpen(true)
    setOcrBannerDismissed(false)
    toast.success('已清除本书 OCR 缓存')
  }, [fileFingerprint, outlineSource, isScannedPdf])

  const runPageOcr = useCallback(
    async (page: number): Promise<string> => {
      if (!fileFingerprint) {
        throw new Error(`第 ${page} 页 OCR 失败：文档指纹未就绪`)
      }

      const pending = ocrPagePendingRef.current.get(page)
      if (pending) return pending

      const task = (async () => {
        setOcrPagesInFlight((prev) => new Set(prev).add(page))
        try {
          const result = await recognizePdfOcrPage({
            filePath,
            fileFingerprint,
            page,
            scale: pdfOcrScale,
          })
          if (result.ok) {
            if (result.value.page !== page) {
              throw new Error(`OCR 结果页码不一致：请求第 ${page} 页，返回第 ${result.value.page} 页`)
            }
            setOcrPageCaches((prev) => ({ ...prev, [page]: result.value }))
            return textFromOcrPageCache(result.value)
          }
          throw new Error(`第 ${page} 页 OCR 失败：${result.error.message}`)
        } finally {
          setOcrPagesInFlight((prev) => {
            const next = new Set(prev)
            next.delete(page)
            return next
          })
        }
      })().finally(() => {
        ocrPagePendingRef.current.delete(page)
      })

      ocrPagePendingRef.current.set(page, task)
      return task
    },
    [fileFingerprint, filePath, pdfOcrScale],
  )

  const handleRecognizePage = useCallback(async () => {
    if (!fileFingerprint || ocrPageRecognizing !== null) return
    setOcrPageRecognizing(pageNum)
    try {
      await runPageOcr(pageNum)
      toast.success(`第 ${pageNum} 页已识别，可划词划重点`)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '本页识别失败或无文字'
      toast.error(message)
    } finally {
      setOcrPageRecognizing(null)
    }
  }, [fileFingerprint, ocrPageRecognizing, pageNum, runPageOcr])

  useEffect(() => {
    pageNumRef.current = pageNum
  }, [pageNum])

  /**
   * 统一正文读取：嵌入文字层 → OCR 缓存 → 扫描版按需 OCR。
   * Agent（inkdown_read 等）与 UI 共用此路径，MCP 工具接口不变。
   */
  const readPageText = useCallback(
    async (page: number, options?: { allowAutoOcr?: boolean }): Promise<string> => {
      const allowAutoOcr = options?.allowAutoOcr ?? true
      const cached = ocrPageCaches[page]
      if (cached?.words.length) {
        assertOcrCachePage(cached, page)
        return textFromOcrPageCache(cached)
      }

      const pdf = pdfDocRef.current
      if (!pdf) {
        throw new Error(`第 ${page} 页无法读取：PDF 尚未加载完成`)
      }

      const native = await readPdfPageNativeText(pdf, page)
      if (!pdfPageNeedsOcr(native)) return native

      if (!isScannedPdf || !fileFingerprint) return native

      if (!allowAutoOcr) {
        throw new Error(
          `第 ${page} 页尚未识别，且已关闭 Agent 自动 OCR。请手动点击工具栏「识别本页」。`,
        )
      }

      return runPageOcr(page)
    },
    [fileFingerprint, isScannedPdf, ocrPageCaches, runPageOcr],
  )

  const readAgentPageText = useCallback(
    async (page: number): Promise<string> => {
      if (!Number.isFinite(page) || page < 1) {
        throw new Error(`无效的 PDF 页码：${page}`)
      }
      const allowAutoOcr = useAppSettingsStore.getState().pdfOcrAgentAutoOcr
      const text = await readPageText(page, { allowAutoOcr })
      const total = numPages || pdfDocRef.current?.numPages || 0
      return formatPdfPageTextForAgent(page, total, text)
    },
    [numPages, readPageText],
  )

  useEffect(() => {
    if (!pdfOcrBackgroundPrefetch || !isScannedPdf || !fileFingerprint || !ready || numPages < 1) {
      return
    }

    let cancelled = false
    const cachedPages = new Set(
      Object.entries(ocrPageCachesRef.current)
        .filter(([, cache]) => cache.words.length > 0)
        .map(([page]) => Number.parseInt(page, 10))
        .filter((page) => Number.isFinite(page)),
    )

    const pages = resolvePdfOcrPrefetchPages(pageNum, numPages, outlineUnits, hasChapterToc, {
      cachedPages,
    })

    void (async () => {
      for (const page of pages) {
        if (cancelled) return
        if (ocrPageCachesRef.current[page]?.words.length) continue
        if (ocrPagePendingRef.current.has(page)) continue
        if (ocrPageRecognizing === page) continue
        try {
          await runPageOcr(page)
        } catch {
          // 后台预识别：单页失败不阻断队列
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    fileFingerprint,
    hasChapterToc,
    isScannedPdf,
    numPages,
    ocrPageRecognizing,
    outlineUnits,
    pageNum,
    pdfOcrBackgroundPrefetch,
    ready,
    runPageOcr,
  ])

  useEffect(() => {
    const agentAutoOcr = () => useAppSettingsStore.getState().pdfOcrAgentAutoOcr
    return registerReaderContent({
      filePath,
      getCurrentText: () => readAgentPageText(pageNumRef.current),
      // PDF 一页 ≈ 视口；多页同时露边时仍以当前页为主
      getViewportText: () => readAgentPageText(pageNumRef.current),
      iterateUnits: async function* () {
        const total = pdfDocRef.current?.numPages ?? 0
        for (let page = 1; page <= total; page += 1) {
          try {
            const allowAutoOcr = agentAutoOcr()
            const text = await readPageText(page, { allowAutoOcr })
            yield {
              label: `第 ${page} 页`,
              text: formatPdfPageTextForAgent(page, total, text),
            }
          } catch {
            // 全书搜索：跳过未识别/失败页，不中断迭代
          }
        }
      },
      getUnitByIndex: async (flatIndex) => {
        const units = useReaderNavigationStore.getState().units
        const unit = units[flatIndex]
        if (!unit) return null
        const page = Number.parseInt('href' in unit ? unit.href : '', 10)
        if (!Number.isFinite(page) || page < 1) {
          return null
        }
        try {
          const raw = await readPageText(page, { allowAutoOcr: agentAutoOcr() })
          const total = pdfDocRef.current?.numPages ?? numPages
          return {
            label: unit.label || `第 ${page} 页`,
            text: formatPdfPageTextForAgent(page, total, raw),
          }
        } catch {
          return null
        }
      },
    })
  }, [filePath, isScannedPdf, readAgentPageText, readPageText])

  useEffect(() => {
    return registerSelectionProvider({
      filePath,
      getSelectionText: () => selectionTransactionRef.current?.text?.trim() || null,
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
    selectionTransactionRef.current = null
    setSelectionSnapshot(null)
    setSelectionToolbarPos(null)
    clearReaderSelection()
  }, [filePath])

  useEffect(() => {
    // 原生 Selection 在 mouseup 后会转成事务；selectionchange 不负责清理业务选区。
    return bindDocumentSelectionCollapse(document, window, () => {})
  }, [])

  useEffect(() => {
    return bindOutsideReaderPointerDismiss((target) => {
      const container = containerRef.current
      if (!container) return false
      if (target.closest('[role="dialog"]')) return true
      return container.contains(target)
    }, () => {
      if (noteDialogOpen) return
      clearTextSelection()
      inspectorRef.current.close()
    })
  }, [clearTextSelection, noteDialogOpen])

  useEffect(() => {
    return () => {
      jumpSettleCancelRef.current?.()
      if (scrollSyncReleaseTimerRef.current != null) {
        window.clearTimeout(scrollSyncReleaseTimerRef.current)
      }
      clearReaderSelection()
    }
  }, [filePath])

  const scaledPageSize = useMemo(
    () => scalePdfPageCssSize(pageCssSize, scale),
    [pageCssSize, scale],
  )

  const holdScrollSync = useCallback((ms: number) => {
    ignoreScrollSyncRef.current = true
    if (scrollSyncReleaseTimerRef.current != null) {
      window.clearTimeout(scrollSyncReleaseTimerRef.current)
    }
    scrollSyncReleaseTimerRef.current = window.setTimeout(() => {
      ignoreScrollSyncRef.current = false
      scrollSyncReleaseTimerRef.current = null
    }, ms)
  }, [])

  const applyScrollToPage = useCallback(
    (
      targetPage: number,
      behavior: ScrollBehavior = 'auto',
      options?: { preferEstimate?: boolean; holdSyncMs?: number },
    ) => {
      const container = containerRef.current
      if (!container) return

      const anchor = pageAnchorRefs.current.get(targetPage)
      const top = resolvePdfPageScrollTop(
        targetPage,
        scaledPageSize.height,
        options?.preferEstimate ? null : (anchor?.offsetTop ?? null),
        PDF_PAGE_GAP_PX,
      )

      holdScrollSync(options?.holdSyncMs ?? (behavior === 'smooth' ? 420 : 80))

      if (behavior === 'auto') {
        container.scrollTop = top
      } else {
        container.scrollTo({ top, behavior })
      }
    },
    [holdScrollSync, scaledPageSize.height],
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
    pendingJumpPageRef.current = null

    jumpSettleCancelRef.current?.()

    // 先按等高估算落位，避免「已渲染真高 + 占位估算」混算把视口甩飞
    applyScrollToPage(targetPage, 'auto', {
      preferEstimate: true,
      holdSyncMs: PDF_JUMP_SYNC_HOLD_MS,
    })

    let cancelled = false
    let frames = 0
    const maxFrames = 45

    const snapToAnchor = () => {
      if (cancelled) return
      const container = containerRef.current
      const anchor = pageAnchorRefs.current.get(targetPage)
      if (!container || !anchor) return
      const top = resolvePdfPageScrollTop(targetPage, scaledPageSize.height, anchor.offsetTop)
      if (Math.abs(container.scrollTop - top) > 1) {
        container.scrollTop = top
      }
    }

    const tick = () => {
      if (cancelled) return
      snapToAnchor()
      frames += 1
      if (frames < maxFrames) {
        window.requestAnimationFrame(tick)
      } else {
        holdScrollSync(120)
      }
    }
    window.requestAnimationFrame(tick)

    const targetEl = pageAnchorRefs.current.get(targetPage)
    let observer: ResizeObserver | null = null
    if (targetEl && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        snapToAnchor()
        holdScrollSync(160)
      })
      observer.observe(targetEl)
    }

    jumpSettleCancelRef.current = () => {
      cancelled = true
      observer?.disconnect()
    }

    return () => {
      jumpSettleCancelRef.current?.()
      jumpSettleCancelRef.current = null
    }
  }, [applyScrollToPage, holdScrollSync, pageNum, scaledPageSize.height, scale])

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
    // 同步快照：避免随后 DOM 变化把 Selection 清掉后读不到
    const immediateSnapshot = readPdfSelection(pageElement, pageNumber)

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
          selectionTransactionRef.current = null
          setSelectionToolbarPos(null)
          setSelectionSnapshot(null)
          inspector.openAt(hits, point.clientX, point.clientY)
          return
        }
      }

      const snapshot = immediateSnapshot ?? readPdfSelection(pageElement, pageNumber)
      if (!snapshot) {
        if (isClickNotDrag(pointerOriginRef.current, point)) {
          inspector.close()
          clearTextSelection()
        }
        return
      }

      inspector.close()
      captureSelectionSnapshot(snapshot)
    }, 10)
  }, [captureSelectionSnapshot, clearTextSelection, inspector, marks])

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
      const snapshot = selectionTransactionRef.current
      if (!snapshot) {
        throw new Error('当前没有可用选区，请先划选文本')
      }
      if (!fileFingerprint) {
        throw new Error('文件尚未加载完成，请稍后再试')
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
          version: snapshot.begin && snapshot.end && snapshot.quads?.length ? 2 : undefined,
          begin: snapshot.begin,
          end: snapshot.end,
          quote: snapshot.quote,
          quads: snapshot.quads,
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

  const handleCreateMarkAt = useCallback(
    async ({ excerpt, note, flatIndex }: CreateMarkAtParams) => {
      if (typeof flatIndex === 'number' && flatIndex >= 0) {
        const navState = useReaderNavigationStore.getState().nav
        if (flatIndex !== navState.flatIndex) {
          goToFlatIndex(flatIndex)
        }
      }

      const totalPages = pdfDocRef.current?.numPages ?? numPages
      const startPage = pageNumRef.current
      // 当前页 → 相邻页（跨页摘录常落在页界附近），不改存储模型（仍单页锚点）
      const candidates: number[] = [startPage]
      for (const delta of [1, -1, 2, -2]) {
        const page = startPage + delta
        if (page >= 1 && page <= totalPages && !candidates.includes(page)) {
          candidates.push(page)
        }
      }

      let snapshot: PdfSelectionSnapshot | null = null
      for (const page of candidates) {
        if (page !== pageNumRef.current) {
          jumpToPage(page)
        }
        snapshot = await waitForDom(() => {
          const pageElement = pageAnchorRefs.current.get(pageNumRef.current)
          if (!pageElement || pageNumRef.current !== page) return null
          const range = findTextRangeInRoot(pageElement, excerpt)
          if (!range) return null
          return buildPdfSnapshotFromRange(pageElement, page, range, excerpt)
        }, { attempts: page === startPage ? 24 : 32, delayMs: 50 })
        if (snapshot) break
      }

      if (!snapshot) {
        throw new Error('未在当前页及相邻页找到该摘录，请翻到对应页后划词重试')
      }

      captureSelectionSnapshot(snapshot)
      return handleSaveAnnotation(note)
    },
    [captureSelectionSnapshot, goToFlatIndex, handleSaveAnnotation, jumpToPage, numPages],
  )

  useEffect(() => {
    return registerReaderMarks({
      filePath,
      createBookmark: () => addPageBookmark(),
      createNoteFromSelection: (note) => handleSaveAnnotation(note),
      createMarkAt: (params) => handleCreateMarkAt(params),
      navigateToFlatIndex: (index) => goToFlatIndex(index),
    })
  }, [addPageBookmark, filePath, goToFlatIndex, handleCreateMarkAt, handleSaveAnnotation])

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

  const handlePdfMarkHoverMove = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (inspector.active || noteDialogOpen || selectionToolbarPos) {
        if (hoveredMark) {
          setHoveredMark(null)
          setMarkTooltipPos(null)
        }
        return
      }

      const target = (event.target as HTMLElement | null)?.closest?.('[data-page]')
      if (!(target instanceof HTMLElement)) {
        if (hoveredMark) {
          setHoveredMark(null)
          setMarkTooltipPos(null)
        }
        return
      }
      const page = Number.parseInt(target.dataset.page ?? '', 10)
      if (!Number.isFinite(page)) return

      const pageElement = pageAnchorRefs.current.get(page)
      if (!pageElement) return

      const hit = findPdfNoteMarkAtPoint(marks, page, event.clientX, event.clientY, pageElement)
      if (!hit) {
        if (hoveredMark) {
          setHoveredMark(null)
          setMarkTooltipPos(null)
        }
        return
      }
      if (hoveredMark?.id === hit.id) {
        setMarkTooltipPos({ x: event.clientX, y: event.clientY })
        return
      }
      setHoveredMark(hit)
      setMarkTooltipPos({ x: event.clientX, y: event.clientY })
    },
    [hoveredMark, inspector.active, marks, noteDialogOpen, selectionToolbarPos],
  )

  const handlePdfMarkHoverLeave = useCallback(() => {
    setHoveredMark(null)
    setMarkTooltipPos(null)
  }, [])

  const marksToc = useMemo(() => tocFromPdfUnits(outlineUnits), [outlineUnits])
  const currentPdfChapter = useMemo(
    () => resolvePdfChapterByPage(pageNum, marksToc),
    [marksToc, pageNum],
  )

  const handleExportNotes = useCallback(
    (contentKind: ReadingNotesContentKind, scope: ReadingNotesScope) => {
      void saveReadingNotesExport({
        marks,
        toc: marksToc,
        contentKind,
        scope,
        currentChapter: scope === 'chapter' ? currentPdfChapter : null,
        filePath,
        resolveChapter: resolvePdfChapter,
      })
    },
    [currentPdfChapter, filePath, marks, marksToc],
  )

  const handleExportAnkiCards = useCallback(
    (scope: ReadingNotesScope) => {
      void saveAnkiCardsExport({
        marks,
        toc: marksToc,
        scope,
        currentChapter: scope === 'chapter' ? currentPdfChapter : null,
        filePath,
        resolveChapter: resolvePdfChapter,
      })
    },
    [currentPdfChapter, filePath, marks, marksToc],
  )

  const estimatedPageHeight = Math.max(120, scaledPageSize.height)
  const estimatedPageWidth = Math.max(120, scaledPageSize.width)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {showOcrBanner ? (
        <PdfOcrBanner
          mode={
            ocrRecognizing
              ? 'recognizing'
              : ocrTocEditorOpen
                ? 're-recognize-toc'
                : 'scanned-no-outline'
          }
          tocPageFrom={tocPageFrom}
          tocPageTo={tocPageTo}
          tocPageOffset={tocPageOffset}
          onTocPageFromChange={setTocPageFrom}
          onTocPageToChange={setTocPageTo}
          onTocPageOffsetChange={setTocPageOffset}
          onRecognize={() => void handleRecognizeToc()}
          onDismiss={() => {
            setOcrTocEditorOpen(false)
            setOcrBannerDismissed(true)
          }}
          entryCount={outlineSource === 'ocr' ? outlineUnits.length : undefined}
        />
      ) : null}
      <ReaderToolbarShell
        ready={ready}
        tocDisabled={!hasChapterToc}
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
            {isScannedPdf ? (
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-7 text-xs"
                disabled={!ready || currentPageOcrBusy}
                onClick={() => void handleRecognizePage()}
              >
                {currentPageOcrBusy ? (
                  <>
                    <Loader2 className="mr-1 size-3.5 animate-spin" />
                    识别中
                  </>
                ) : currentPageOcrReady ? (
                  '重新识别本页'
                ) : (
                  '识别本页'
                )}
              </Button>
            ) : null}
            {isScannedPdf && outlineSource === 'ocr' ? (
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-7 text-xs"
                disabled={ocrRecognizing}
                onClick={() => setOcrTocEditorOpen(true)}
              >
                重新识别目录
              </Button>
            ) : null}
            {isScannedPdf && (ocrRecognizedCount > 0 || outlineSource === 'ocr') ? (
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-7 text-xs text-muted-foreground"
                onClick={() => void handleClearOcrCache()}
              >
                清除缓存
              </Button>
            ) : null}
          </>
        }
        trailing={
          isLoading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : isScannedPdf ? (
            <span className="text-xs text-muted-foreground">
              {currentPageOcrBusy
                ? `识别中… · ${ocrRecognizedCount}/${numPages}`
                : currentPageOcrReady
                  ? `已识别 ${ocrRecognizedCount}/${numPages}`
                  : `本页未识别 · ${ocrRecognizedCount}/${numPages}`}
            </span>
          ) : null
        }
      />

      <ReaderContentShell
        marksOpen={marksOpen}
        marks={marks}
        onSelectMark={handleSelectMark}
        onDeleteMark={(mark) => void handleDeleteMark(mark)}
        onCloseMarks={() => setMarksOpen(false)}
        onExportNotes={handleExportNotes}
        onExportAnkiCards={handleExportAnkiCards}
        marksToc={marksToc}
        marksCurrentChapterKey={currentPdfChapter.key}
        marksResolveChapter={resolvePdfChapter}
        tocOpen={tocOpen}
        units={outlineUnits}
        currentUnitId={currentUnitId ?? String(pageNum)}
        onCloseToc={() => setTocOpen(false)}
        onSelectUnit={(unit) => {
          goToUnit(unit)
          setTocOpen(false)
        }}
        onEditToc={outlineSource === 'ocr' ? handleOpenOcrTocEditor : undefined}
        outlineNotice={outlineSource === 'ocr' ? undefined : outlineNotice}
        tocAside={
          ocrTocEditMode && outlineSource === 'ocr' ? (
            <PdfOcrTocEditor
              entries={ocrTocEntries}
              pageOffset={tocPageOffset}
              saving={ocrTocSaving}
              onToggle={() => setTocOpen(false)}
              onSave={(entries) => void handleSaveOcrToc(entries)}
              onCancel={() => setOcrTocEditMode(false)}
            />
          ) : undefined
        }
      >
        <div
          ref={containerRef}
          className={`h-full min-h-0 overflow-auto ${theme === 'dark' ? 'bg-zinc-900' : 'bg-zinc-100'}`}
          onMouseMove={handlePdfMarkHoverMove}
          onMouseLeave={handlePdfMarkHoverLeave}
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
                      // 激活页 canvas 为 absolute，异步量尺寸前必须占位，否则远跳时高度塌成黑屏
                      style={{
                        minHeight: estimatedPageHeight,
                        minWidth: estimatedPageWidth,
                      }}
                      data-page={page}
                    >
                      {active ? (
                        <PdfPageView
                          pdf={pdfDoc}
                          pageNumber={page}
                          scale={scale}
                          theme={theme}
                          marks={marks}
                          ocrPageCache={ocrPageCaches[page] ?? null}
                          transientSelection={
                            selectionSnapshot?.page === page ? selectionSnapshot : null
                          }
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

      {markTooltipPos && hoveredMark && !inspector.active ? (
        <EpubMarkTooltip mark={hoveredMark} x={markTooltipPos.x} y={markTooltipPos.y} />
      ) : null}

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
            if (!selectionTransactionRef.current && !selectionSnapshot) {
              toast.error('当前没有可用选区，请先划选文本')
              return
            }
            if (selectionSnapshot) {
              selectionTransactionRef.current = selectionSnapshot
            }
            setEditingNoteMark(null)
            setNoteDialogOpen(true)
            setSelectionToolbarPos(null)
          }}
          onHighlight={(color) => {
            if (selectionSnapshot) {
              selectionTransactionRef.current = selectionSnapshot
            }
            void handleSaveAnnotation('', color).catch((cause) => {
              toast.error(cause instanceof Error ? cause.message : '添加高亮失败')
            })
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
        filePath={filePath}
        fileFingerprint={fileFingerprint}
        aiAssist
        excerpt={editingNoteMark?.excerpt ?? selectionSnapshot?.text}
        initialNote={editingNoteMark?.note ?? ''}
        title={editingNoteMark ? '编辑批注' : '添加批注'}
        onOpenChange={(open) => {
          setNoteDialogOpen(open)
          if (!open) {
            setEditingNoteMark(null)
            // 取消「添加批注」且未保存：清掉业务快照
            if (!editingNoteMark) {
              const selection = window.getSelection()
              if (!selection || selection.isCollapsed || !selection.toString().trim()) {
                clearTextSelection()
              }
            }
          }
        }}
        onSave={(note) => {
          if (editingNoteMark) {
            void updateMark({
              id: editingNoteMark.id,
              note,
              kind: editingNoteMark.kind === 'highlight' ? 'highlight' : 'note',
            }).then((result) => {
              if (isOk(result)) toast.success(note.trim() ? '已保存批注' : '已清除批注')
              else toast.error(result.error.message || '更新批注失败')
            })
            return
          }
          void handleSaveAnnotation(note)
            .then(() => {
              setNoteDialogOpen(false)
            })
            .catch((cause) => {
              toast.error(cause instanceof Error ? cause.message : '保存批注失败')
            })
        }}
      />
    </div>
  )
}
