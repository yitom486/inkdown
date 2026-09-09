import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Database, Loader2, Minus, Plus, ScanText, X } from 'lucide-react'
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
import { useReaderSelectionActions } from '@/hooks/reader/useReaderSelectionActions'
import { useRosettaImport } from '@/hooks/reader/useRosettaImport'
import { rosettaApi } from '@/api/rosetta-api'
import { resolveRosettaTocEntries } from '@/lib/reader/rosetta-toc'
import { canUseOcrToc } from '@/lib/reader/pdf-ocr-toc-gate'
import {
  TOC_DRAFT_GUARD_MESSAGE,
  TocDocLifecycle,
  isLiveLoadSession,
  tocBusyMessage,
  type OcrTocOperation,
  type TocOpLease,
} from '@/lib/reader/ocr-toc-op'
import { resolveDetectApply } from '@shared/reader/toc-page-detect'
import {
  noticeForFreshRecognize,
  noticeForRestoredCache,
  placeOcrTocNotice,
  type OcrTocNotice,
} from '@/lib/reader/ocr-toc-notice'
import { assessPdfOcrTocCache } from '@shared/reader/ocr-toc-assess'
import { reassembleDirectoryText } from '@shared/reader/directory-reassemble'
import { ACP_MAX_IMAGE_BYTES, blobToBase64 } from '@/lib/agent/acp-composer'
import type { TocPromptImage } from '@/lib/agent/toc-ai-session'
import { renderPdfPagesToPng } from '@/lib/reader/pdf-page-image'
import { formatRosettaBlocksForAgent } from '@/lib/reader/rosetta-agent-text'
import type { RosettaBookInfo, RosettaImportState } from '@shared/types/rosetta'
import { usePdfPageOcr } from '@/hooks/reader/usePdfPageOcr'
import { useReaderExportMenu } from '@/hooks/reader/useReaderExportMenu'
import { registerReaderContent } from '@/lib/agent/context/reader-content-registry'
import { registerReaderMarks } from '@/lib/agent/context/reader-marks-registry'
import { registerSelectionProvider, commitReaderSelection, clearReaderSelection } from '@/lib/agent/context/reader-selection-registry'
import { DEFAULT_HIGHLIGHT_COLOR } from '@/lib/reader/reading-mark-colors'
import { useReadingMarks } from '@/hooks/reader/useReadingMarks'
import { loadPdfOutlineInfo, formatPdfOutlineNotice, type PdfOutlineSource } from '@/lib/reader/pdf-outline'
import { detectPdfDocumentProfile } from '@/lib/reader/pdf-scan-detector'
import {
  clearPdfOcrCache,
  detectPdfTocPages,
  getPdfOcrPage,
  listPdfOcrPages,
  recognizePdfOcrToc,
  getPdfOcrToc,
  savePdfOcrToc,
} from '@/api/ocr-api'
import { buildPdfOcrTocCache, resolveOcrTocEditorEntries } from '@/lib/reader/pdf-ocr-toc-cache'
import {
  formatPdfPageTextForAgent,
} from '@/lib/reader/pdf-page-text'
import { isStructuredPageTextUsable } from '@/lib/reader/pdf-structure'
import { pdfStructureClient } from '@/lib/reader/pdf-structure-client'
import { pdfInspectorClient } from '@/lib/reader/pdf-inspector-client'

declare global {
  interface Window {
    /** E2E 专用钩子（仅 E2E_PDF_STRUCTURE 门控开启时挂载） */
    __inkdownE2ePdfStructure?: {
      readCurrentPage: () => Promise<{ source: string; prefix: string }>
      status: () => { status: string; reason: string }
      inspectorStatus: () => { status: string; reason: string }
    }
  }
}
import { PdfOcrBanner } from '@/components/reader/PdfOcrBanner'
import { PdfOcrTocEditor } from '@/components/reader/PdfOcrTocEditor'
import { TocAiPolishControl } from '@/components/reader/TocAiPolishControl'
import type { OcrTocEntry } from '@shared/types/ocr'
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
} from '@/lib/reader/export-reading-notes'
import { resolvePdfOcrPrefetchPages } from '@/lib/reader/pdf-ocr-prefetch'
import { suggestTocPageOffset } from '@/lib/reader/toc-offset'
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
  /** 混合文档：部分抽样页无文字层；仅放行单页自动 OCR，不触发扫描横幅与后台预识别 */
  const [isMixedPdf, setIsMixedPdf] = useState(false)
  const [ocrBannerDismissed, setOcrBannerDismissed] = useState(false)
  const [ocrTocEditorOpen, setOcrTocEditorOpen] = useState(false)
  /** OCR 目录缓存状态的独立提示（不复用 outlineNotice：后者在 OCR 侧栏下被抹掉） */
  const [ocrTocNotice, setOcrTocNotice] = useState<OcrTocNotice | null>(null)
  const [ocrTocEditMode, setOcrTocEditMode] = useState(false)
  const [ocrTocEntries, setOcrTocEntries] = useState<OcrTocEntry[]>([])
  const [ocrTocSaving, setOcrTocSaving] = useState(false)
  const [ocrRecognizing, setOcrRecognizing] = useState(false)
  const [tocPageFrom, setTocPageFrom] = useState(8)
  const [tocPageTo, setTocPageTo] = useState(12)
  const [tocPageOffset, setTocPageOffset] = useState(12)
  /** 目录页探测中：与正式识别/保存互斥（只填范围，不识别不缓存） */
  const [tocDetecting, setTocDetecting] = useState(false)
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
  /**
   * 目录操作生命周期（租约锁 + 文档世代，见 ocr-toc-op.TocDocLifecycle）：
   * 布尔 state 只负责按钮禁用等渲染，真正的门是同步租约（快速连点绕不过），
   * 回写门另要世代未变（切文件旧任务一律拦下，含清 busy）。
   */
  const tocLifecycleRef = useRef<TocDocLifecycle | null>(null)
  if (tocLifecycleRef.current === null) {
    tocLifecycleRef.current = new TocDocLifecycle()
  }
  const beginTocOp = useCallback((operation: OcrTocOperation): TocOpLease | null => {
    const lifecycle = tocLifecycleRef.current
    const lease = lifecycle ? lifecycle.begin(operation) : null
    if (lease) return lease
    toast.error(tocBusyMessage(lifecycle?.current() ?? null) ?? '目录操作进行中，请稍候')
    return null
  }, [])
  const endTocOp = useCallback((lease: TocOpLease): void => {
    tocLifecycleRef.current?.end(lease)
  }, [])
  /** 回写门：租约仍是当前持有者且世代未变（旧文件任务一律拦下，含清 busy） */
  const isLiveTocOp = useCallback((lease: TocOpLease, session: number): boolean => {
    return tocLifecycleRef.current?.isLive(lease, session) ?? false
  }, [])

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

  const {
    ocrPageCaches,
    ocrPageCachesRef,
    ocrPageRecognizing,
    currentPageOcrReady,
    currentPageOcrBusy,
    ocrRecognizedCount,
    runPageOcr,
    readPageText,
    handleRecognizePage,
    hasPendingPageOcr,
    hydratePageCaches,
    resetPageOcr,
  } = usePdfPageOcr({
    filePath,
    fileFingerprint,
    pageNum,
    pdfDocRef,
    isScannedPdf,
    isMixedPdf,
    // 与覆盖层同族：pdfjs scale:1 视口即 PDF 点尺寸（含旋转）
    getPageSizePt: useCallback(async (page: number) => {
      const pdf = pdfDocRef.current
      if (!pdf) return null
      try {
        const proxy = await pdf.getPage(page)
        const viewport = proxy.getViewport({ scale: 1 })
        if (!(viewport.width > 0) || !(viewport.height > 0)) return null
        return { width: viewport.width, height: viewport.height }
      } catch {
        return null
      }
    }, []),
  })

  const ready = numPages > 0 && pdfDoc !== null

  const rosettaImport = useRosettaImport(fileFingerprint)
  const rosettaInfoRef = useRef<RosettaBookInfo | null>(null)
  useEffect(() => {
    rosettaInfoRef.current = rosettaImport.info
  }, [rosettaImport.info])
  const rosettaImportStateRef = useRef<RosettaImportState>('idle')
  useEffect(() => {
    rosettaImportStateRef.current = rosettaImport.state
  }, [rosettaImport.state])

  /** 罗盘走库读页：命中即返回结构化文本，未命中回 null 走旧链路（永不抛错） */
  const readRosettaPageText = useCallback(
    async (page: number): Promise<string | null> => {
      if (!fileFingerprint || !rosettaInfoRef.current) return null
      try {
        const result = await rosettaApi.queryBook({ kind: 'page', fingerprint: fileFingerprint, page })
        if (!isOk(result) || result.value.kind !== 'page' || result.value.blocks.length === 0) {
          return null
        }
        return formatRosettaBlocksForAgent(result.value.blocks)
      } catch {
        return null
      }
    },
    [fileFingerprint],
  )

  /** 罗盘走库读单元：目录单元所在章整章文本，未命中回 null */
  const readRosettaUnitText = useCallback(
    async (unit: ReaderUnit): Promise<{ label: string; text: string } | null> => {
      if (!fileFingerprint || !rosettaInfoRef.current) return null
      const page = Number.parseInt('href' in unit ? unit.href : '', 10)
      if (!Number.isFinite(page) || page < 1) return null
      try {
        const chaptersResult = await rosettaApi.queryBook({ kind: 'chapters', fingerprint: fileFingerprint })
        if (!isOk(chaptersResult) || chaptersResult.value.kind !== 'chapters') return null
        let current: { index: number; title: string } | null = null
        for (const chapter of chaptersResult.value.chapters) {
          if (chapter.startPage <= page) current = chapter
          else break
        }
        if (!current) return null
        const blocksResult = await rosettaApi.queryBook({
          kind: 'chapter',
          fingerprint: fileFingerprint,
          chapterIndex: current.index,
        })
        if (!isOk(blocksResult) || blocksResult.value.kind !== 'chapter' || blocksResult.value.blocks.length === 0) {
          return null
        }
        return { label: current.title, text: formatRosettaBlocksForAgent(blocksResult.value.blocks) }
      } catch {
        return null
      }
    },
    [fileFingerprint],
  )

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

  /**
   * 文档切换边界（只依赖 filePath/fileFingerprint，不经过 data）：
   * useReaderBinary 切 queryKey 后 data 可能暂时为空（未缓存/失败），
   * 若把世代推进放在 data 后面，旧任务会在新文件加载期继续通过回写门。
   * 这里用 layout effect 先于 passive data effect 与用户交互执行：
   * 世代 +1、作废租约、清三种 busy 与旧目录状态；data effect 不再重复。
   * 同路径换内容（fingerprint 变、path 不变）同样视为新文档。
   */
  useLayoutEffect(() => {
    tocLifecycleRef.current?.switchDocument()
    setOcrRecognizing(false)
    setTocDetecting(false)
    setOcrTocSaving(false)
    setOutlineUnits([])
    setOutlineSource('page-fallback')
    setOutlineNotice(undefined)
    setIsScannedPdf(false)
    setIsMixedPdf(false)
    setOcrTocEditorOpen(false)
    setOcrTocEditMode(false)
    setOcrTocEntries([])
    setOcrTocNotice(null)
  }, [filePath, fileFingerprint])

  useEffect(() => {
    // 文档切换即释放结构化 Worker 与整档缓存（大文档内存不跨文档驻留）
    pdfStructureClient.dispose()
    pdfInspectorClient.dispose()
    if (!data) return

    let cancelled = false
    pdfDocRef.current = null
    loadingTaskRef.current = null
    setPdfDoc(null)
    setPageNum(1)
    setNumPages(0)
    // 目录/OCR 内容状态已由 filePath layout effect 清理（不经过 data）；
    // 这里只负责打开 PDF、恢复缓存和初始化页面
    setOcrBannerDismissed(false)
    resetPageOcr()
    setTocOpen(false)
    pageAnchorRefs.current.clear()

    // 本次加载的世代 + 统一回写门：每次 await 返回、写任何状态前必过此门；
    // 失活即销毁局部任务并直接退出，不跳过某段再写旧数据
    const loadSession = tocLifecycleRef.current?.currentSession() ?? 0
    const isLiveLoad = (): boolean =>
      isLiveLoadSession(cancelled, loadSession, tocLifecycleRef.current?.currentSession() ?? -1)

    void (async () => {
      try {
        const loadingTask = openPdfDocument({ data: data.data.slice() })
        loadingTaskRef.current = loadingTask
        const pdf = await loadingTask.promise
        if (!isLiveLoad()) {
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
        if (!isLiveLoad()) return
        {
          const viewport = firstPage.getViewport({ scale: 1 })
          setPageCssSize({ width: viewport.width, height: viewport.height })
        }

        const units = await loadPdfOutlineInfo(pdf)
        const profile = await detectPdfDocumentProfile(pdf)
        if (!isLiveLoad()) return
        setIsScannedPdf(profile.isScanned)
        setIsMixedPdf(profile.mixed)

        let nextUnits = units.units
        let nextSource: PdfOutlineSource | 'ocr' = units.source
        let nextNotice = formatPdfOutlineNotice(units, profile.isScanned)

        if (
          fileFingerprint &&
          canUseOcrToc({
            outlineSource: units.source,
            isScannedPdf: profile.isScanned,
            isMixedPdf: profile.mixed,
          })
        ) {
          const cacheResult = await getPdfOcrToc({ fileFingerprint })
          if (!isLiveLoad()) return
          // 旧文件慢回包不得写回新文件界面（与三操作同世代门）
          if (cacheResult.ok) {
            // 分级恢复：usable 照常；invalid 不进侧栏（原因进横幅附加行）；
            // suspect/legacy 照常供阅读，提示走独立 ocrTocNotice（不再写
            // outlineNotice：它在 OCR 侧栏下被抹掉，不打开侧栏不可见）。
            // 从不自动删除任何缓存。
            const assessment = assessPdfOcrTocCache(cacheResult.value, {
              pageCount: pdf.numPages,
            })
            console.info(
              `[ocr-toc] restore status=${assessment.status} reasons=${JSON.stringify(assessment.reasons)}`,
            )
            const notice = noticeForRestoredCache(assessment)
            if (assessment.status === 'invalid') {
              setOcrTocNotice(notice)
            } else {
              const cache = cacheResult.value
              nextUnits = assessment.repairedUnits ?? cache.units
              nextSource = 'ocr'
              setTocPageFrom(cache.tocPageRange[0])
              setTocPageTo(cache.tocPageRange[1])
              setTocPageOffset(cache.pageOffset)
              setOcrTocEntries(cache.entries)
              nextNotice = undefined
              setOcrTocNotice(notice)
            }
          }
        }

        // 失活即直接退出：不得跳过恢复后再把旧 embedded outline 写入
        if (!isLiveLoad()) return
        setOutlineUnits(nextUnits)
        setOutlineSource(nextSource)
        setOutlineNotice(nextNotice)

        if (!isLiveLoad()) return
        if (profile.isScanned && fileFingerprint) {
          const pagesResult = await listPdfOcrPages({ fileFingerprint })
          if (!isLiveLoad()) return
          if (pagesResult.ok && pagesResult.value.length > 0) {
            const entries = await Promise.all(
              pagesResult.value.map(async (pageNumber) => {
                const pageResult = await getPdfOcrPage({ fileFingerprint, page: pageNumber })
                if (!pageResult.ok || pageResult.value.page !== pageNumber) return null
                return [pageNumber, pageResult.value] as const
              }),
            )
            if (!isLiveLoad()) return
            hydratePageCaches(Object.fromEntries(entries.filter((item) => item !== null)))
          }
        }
      } catch (cause) {
        // 旧加载失败不得向新文件弹 FILE_READ_ERROR
        if (!isLiveLoad()) return
        reportAppError({
          code: 'FILE_READ_ERROR',
          message: cause instanceof Error ? cause.message : 'PDF 加载失败',
        })
      }
    })()

    return () => {
      cancelled = true
      pdfStructureClient.dispose()
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
    if (!fileFingerprint) return
    // 编辑器有未保存草稿时不得悄悄覆盖：先让人保存或取消
    if (ocrTocEditMode) {
      toast.error(TOC_DRAFT_GUARD_MESSAGE)
      return
    }
    // 租约先行：参数错误与识别失败都在 finally 释放，见末尾
    const lease = beginTocOp('recognize')
    if (!lease) return
    const session = tocLifecycleRef.current?.currentSession() ?? 0
    setOcrRecognizing(true)
    try {
      if (!Number.isInteger(numPages) || numPages < 1) {
        toast.error('PDF 尚未加载完成，请稍后再试')
        return
      }
      const result = await recognizePdfOcrToc({
        filePath,
        fileFingerprint,
        fromPage: Math.min(tocPageFrom, tocPageTo),
        toPage: Math.max(tocPageFrom, tocPageTo),
        pageOffset: tocPageOffset,
        scale: pdfOcrScale,
        pageCount: numPages,
      })
      // 旧文件任务结果绝不写回新文件界面（含 toast 与 notice）
      if (!isLiveTocOp(lease, session)) return
      if (result.ok) {
        setOutlineUnits(result.value.units)
        setOutlineSource('ocr')
        setOcrTocEntries(result.value.entries)
        setTocOpen(true)
        setOcrTocEditorOpen(false)
        // 自动识别当次即视为 suspect：可继续阅读，当场给出核对入口（非阻塞）
        setOcrTocNotice(noticeForFreshRecognize(result.value.units.length))
        toast.success(`已识别 ${result.value.units.length} 条目录`)
      } else {
        toast.error(result.error.message)
      }
    } finally {
      // 旧任务不得清掉新任务的 busy：世代已变则跳过
      if (isLiveTocOp(lease, session)) setOcrRecognizing(false)
      endTocOp(lease)
    }
  }, [fileFingerprint, filePath, ocrTocEditMode, tocPageFrom, tocPageTo, tocPageOffset, pdfOcrScale, numPages, beginTocOp, endTocOp, isLiveTocOp])

  const handleSaveOcrToc = useCallback(
    async (entries: OcrTocEntry[]) => {
      if (!fileFingerprint) return
      // 保存即解决草稿归属，不做草稿门；租约锁保证不与探测/识别交错写缓存
      const lease = beginTocOp('save')
      if (!lease) return
      const session = tocLifecycleRef.current?.currentSession() ?? 0
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
        // 主进程写的是旧指纹文件（自然结束无害）；界面回写只认本世代
        if (!isLiveTocOp(lease, session)) return
        if (!result.ok) {
          toast.error(result.error.message)
          return
        }
        setOcrTocEntries(cache.entries)
        setOutlineUnits(cache.units)
        setOcrTocEditMode(false)
        // 用户保存确认（reviewed）：提示立即消失
        setOcrTocNotice(null)
        toast.success('目录已保存')
      } finally {
        if (isLiveTocOp(lease, session)) setOcrTocSaving(false)
        endTocOp(lease)
      }
    },
    [fileFingerprint, tocPageFrom, tocPageTo, tocPageOffset, beginTocOp, endTocOp, isLiveTocOp],
  )

  /**
   * 自动查找目录页：只把建议范围填入输入框，不发起正式识别、不写缓存。
   * 与正式识别/保存互斥；ambiguous/not-found 保留用户当前范围并说明原因。
   */
  const handleDetectTocPages = useCallback(async () => {
    if (!fileFingerprint) return
    // 编辑器有未保存草稿时不得动范围输入：先让人保存或取消
    if (ocrTocEditMode) {
      toast.error(TOC_DRAFT_GUARD_MESSAGE)
      return
    }
    // 租约先行：参数错误与探测失败都在 finally 释放，见末尾
    const lease = beginTocOp('detect')
    if (!lease) return
    const session = tocLifecycleRef.current?.currentSession() ?? 0
    setTocDetecting(true)
    try {
      if (!Number.isInteger(numPages) || numPages < 1) {
        toast.error('PDF 尚未加载完成，请稍后再试')
        return
      }
      const result = await detectPdfTocPages({ filePath, pageCount: numPages })
      // 旧文件探测结果不得改写新文件范围输入
      if (!isLiveTocOp(lease, session)) return
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      const applied = resolveDetectApply(
        { fromPage: tocPageFrom, toPage: tocPageTo },
        result.value,
      )
      if (applied.changed) {
        setTocPageFrom(applied.fromPage)
        setTocPageTo(applied.toPage)
      }
      if (applied.toast === 'suggest') {
        toast.success(`已建议第 ${applied.fromPage}–${applied.toPage} 页，请核对后识别`)
      } else if (result.value.outcome === 'ambiguous') {
        toast.message(result.value.reason ?? '发现多处疑似目录，已保留当前范围')
      } else {
        toast.message(result.value.reason ?? '未找到可靠目录页，已保留当前范围')
      }
    } finally {
      if (isLiveTocOp(lease, session)) setTocDetecting(false)
      endTocOp(lease)
    }
  }, [fileFingerprint, filePath, ocrTocEditMode, numPages, tocPageFrom, tocPageTo, beginTocOp, endTocOp, isLiveTocOp])

  const [suggestingOffset, setSuggestingOffset] = useState(false)

  /** AI 整理用：目录范围页正文（允许按需 OCR，顺带预热页缓存） */
  const getTocOcrText = useCallback(async (): Promise<string | null> => {
    const from = Math.min(tocPageFrom, tocPageTo)
    const to = Math.max(tocPageFrom, tocPageTo)
    const parts: string[] = []
    for (let page = from; page <= to; page += 1) {
      try {
        const text = await readPageText(page)
        if (text.trim()) parts.push(`--- PDF 第 ${page} 页 ---\n${text}`)
      } catch {
        // 单页失败跳过，不阻断整理
      }
    }
    const joined = parts.join('\n').trim()
    if (!joined) return null
    // 先重组再给模型：竖线拆分/数字汤配对/范围门，与启发式同一套
    const { text, stats } = reassembleDirectoryText(joined, {
      pageCount: numPages,
      pageOffset: tocPageOffset,
    })
    console.info(
      `[toc-ai] reassemble pipe=${stats.pipeRows} paired=${stats.paired} ` +
        `pool=${stats.poolNumbers} droppedPool=${stats.droppedPool} ` +
        `bare=${stats.bareEmitted} dropped=${stats.droppedLines}`,
    )
    return text.trim() || null
  }, [tocPageFrom, tocPageTo, readPageText, numPages, tocPageOffset])

  /** AI 整理用：目录范围页原图（离屏渲染 PNG；单页失败跳过，超限跳过） */
  const getTocPageImages = useCallback(async (): Promise<TocPromptImage[] | null> => {
    const pdf = pdfDocRef.current
    if (!pdf) return null
    const from = Math.min(tocPageFrom, tocPageTo)
    const to = Math.max(tocPageFrom, tocPageTo)
    const pages: number[] = []
    for (let page = from; page <= to; page += 1) pages.push(page)
    const rendered = await renderPdfPagesToPng(pdf, pages, 1.5)
    if (rendered.length === 0) return null
    const images: TocPromptImage[] = []
    for (const item of rendered) {
      if (item.blob.size > ACP_MAX_IMAGE_BYTES) continue
      try {
        images.push({
          base64: await blobToBase64(item.blob),
          mimeType: 'image/png',
          name: `toc-p${item.page}.png`,
        })
      } catch {
        // 单张转换失败跳过
      }
    }
    return images.length > 0 ? images : null
  }, [tocPageFrom, tocPageTo])

  /**
   * 自动推算偏移：目录前若干标题去正文页原生文字层找锚点，多标题共识。
   * 只读原生层（allowAutoOcr: false）：扫描正文页无文字层时匹配不上，
   * 此时提示手填——预期行为。
   */
  const handleSuggestOffset = useCallback(async () => {
    if (suggestingOffset) return
    if (ocrTocEntries.length === 0) {
      toast.error('请先识别目录')
      return
    }
    setSuggestingOffset(true)
    try {
      const from = Math.min(tocPageFrom, tocPageTo)
      const to = Math.max(tocPageFrom, tocPageTo)
      const skip: number[] = []
      for (let page = from; page <= to; page += 1) skip.push(page)
      const result = await suggestTocPageOffset(
        ocrTocEntries,
        async (pdfPage) => {
          try {
            return await readPageText(pdfPage, { allowAutoOcr: false })
          } catch {
            return null
          }
        },
        { pageCount: numPages, skipPdfPages: skip },
      )
      if (!result) {
        toast.error('正文页无文字层，无法自动推算，请手填偏移')
        return
      }
      setTocPageOffset(result.offset)
      if (result.agree < result.total) {
        toast.message(
          `已按 ${result.agree}/${result.total} 个标题对齐：偏移=${result.offset}，其余未对齐，请核对`,
        )
      } else {
        toast.success(`已按 ${result.total} 个标题对齐：偏移=${result.offset}`)
      }
    } finally {
      setSuggestingOffset(false)
    }
  }, [suggestingOffset, ocrTocEntries, tocPageFrom, tocPageTo, numPages, readPageText])

  const handleOpenOcrTocEditor = useCallback(() => {
    const fallbackUnits = outlineUnits.map((unit) => ({
      label: unit.label,
      href: unit.href,
      level: unit.level,
    }))
    // 真正进入编辑模式（可编辑目录 + AI 核对入口 + 保存按钮），不发起 OCR；
    // 条目决议走纯函数（状态条“校正目录”按钮复用同一转换，见 resolveOcrTocEditorEntries 单测）
    setOcrTocEntries((prev) =>
      resolveOcrTocEditorEntries({
        ocrTocEntries: prev,
        outlineUnits: fallbackUnits,
        pageOffset: tocPageOffset,
      }),
    )
    setOcrTocEditMode(true)
    setTocOpen(true)
  }, [outlineUnits, tocPageOffset])

  useEffect(() => {
    if (outlineSource === 'ocr') return
    setTocPageOffset(tocPageTo)
  }, [outlineSource, tocPageTo])

  /** OCR 目录可用（纯扫描沿用旧行为；混合无内置目录新增入口与缓存恢复） */
  const ocrTocAvailable = canUseOcrToc({ outlineSource, isScannedPdf, isMixedPdf })
  /** 目录三操作（探测/识别/保存）任一运行中：可见入口同步禁用（锁负责逻辑互斥） */
  const ocrTocBusy = ocrRecognizing || tocDetecting || ocrTocSaving

  const showOcrBanner =
    (ocrTocAvailable && outlineSource === 'page-fallback' && !ocrBannerDismissed) ||
    ocrRecognizing ||
    (ocrTocAvailable && ocrTocEditorOpen)

  /** 独立缓存状态提示的落点：invalid 跟横幅（即识别入口），其余走状态条（不依赖侧栏） */
  const placedOcrTocNotice = placeOcrTocNotice(ocrTocNotice, outlineSource)

  const pdfOcrBackgroundPrefetch = useAppSettingsStore((state) => state.pdfOcrBackgroundPrefetch)

  const handleClearOcrCache = useCallback(async () => {
    if (!fileFingerprint) return
    if (!window.confirm('将清除本书已识别的正文页与目录缓存，是否继续？')) return

    const result = await clearPdfOcrCache({ fileFingerprint })
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }

    resetPageOcr()

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
    setOcrTocNotice(null)
    toast.success('已清除本书 OCR 缓存')
  }, [fileFingerprint, outlineSource, isScannedPdf, resetPageOcr])

  useEffect(() => {
    pageNumRef.current = pageNum
  }, [pageNum])

  const readAgentPageTextWithSource = useCallback(
    async (page: number): Promise<{ text: string; source: 'inspector' | 'structured' | 'legacy' | 'rosetta' }> => {
      if (!Number.isFinite(page) || page < 1) {
        throw new Error(`无效的 PDF 页码：${page}`)
      }
      const total = numPages || pdfDocRef.current?.numPages || 0
      // 罗盘优先：已索引的书直接读库（结构化分页文本，零 OCR 开销）；
      // 未命中/异常一律静默回退旧链路，Agent 永不断粮
      const rosettaText = await readRosettaPageText(page)
      if (rosettaText !== null) {
        return { text: formatPdfPageTextForAgent(page, total, rosettaText), source: 'rosetta' }
      }
      // Agent 正文：主进程 inspector（表格/标题更优）→ WASM 阅读顺序版；
      // 任何失败静默回退，UI/搜索/选区仍走 pdf.js
      const docKey = fileFingerprint || filePath
      // 导入期禁全量解析：罗盘整书 OCR 独占主进程堆时，Agent 再触发一次
      // 全文档解析会堆叠压垮（Rust 分配失败直接 abort 主进程）。缓存照读、
      // 单页 OCR 照走（有界），只禁整文档解析。
      const importRunning = rosettaImportStateRef.current === 'running'
      let inspected: string | null = pdfInspectorClient.getCachedPageText(docKey, page)
      if (inspected === null && !importRunning && !pdfInspectorClient.isUnavailable()) {
        const parsed = await pdfInspectorClient.parseDocument(docKey, filePath)
        if (parsed) inspected = pdfInspectorClient.getCachedPageText(docKey, page)
      }
      if (inspected !== null && isStructuredPageTextUsable(inspected)) {
        return { text: formatPdfPageTextForAgent(page, total, inspected), source: 'inspector' }
      }
      let structured: string | null = pdfStructureClient.getCachedPageText(docKey, page)
      if (structured === null && !importRunning && data && !pdfStructureClient.isUnavailable()) {
        const parsed = await pdfStructureClient.parseDocument(docKey, data.data.slice(0))
        if (parsed) structured = pdfStructureClient.getCachedPageText(docKey, page)
      }
      if (structured !== null && isStructuredPageTextUsable(structured)) {
        return { text: formatPdfPageTextForAgent(page, total, structured), source: 'structured' }
      }
      const allowAutoOcr = useAppSettingsStore.getState().pdfOcrAgentAutoOcr
      const text = await readPageText(page, { allowAutoOcr })
      return { text: formatPdfPageTextForAgent(page, total, text), source: 'legacy' }
    },
    [data, fileFingerprint, filePath, numPages, readPageText, readRosettaPageText],
  )

  const readAgentPageTextWithSourceRef = useRef(readAgentPageTextWithSource)
  readAgentPageTextWithSourceRef.current = readAgentPageTextWithSource

  const readAgentPageText = useCallback(
    (page: number): Promise<string> =>
      readAgentPageTextWithSource(page).then((result) => result.text),
    [readAgentPageTextWithSource],
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
        if (hasPendingPageOcr(page)) continue
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
        // 罗盘优先：按章整章产出，AI 全书检索不再逐页现场 OCR
        if (fileFingerprint && rosettaInfoRef.current) {
          try {
            const chaptersResult = await rosettaApi.queryBook({ kind: 'chapters', fingerprint: fileFingerprint })
            if (isOk(chaptersResult) && chaptersResult.value.kind === 'chapters' && chaptersResult.value.chapters.length > 0) {
              let yielded = 0
              for (const chapter of chaptersResult.value.chapters) {
                const blocksResult = await rosettaApi.queryBook({
                  kind: 'chapter',
                  fingerprint: fileFingerprint,
                  chapterIndex: chapter.index,
                })
                if (!isOk(blocksResult) || blocksResult.value.kind !== 'chapter' || blocksResult.value.blocks.length === 0) {
                  continue
                }
                yielded += 1
                yield {
                  label: chapter.title,
                  text: `【${chapter.title} · 第 ${chapter.startPage}-${chapter.endPage} 页】\n${formatRosettaBlocksForAgent(blocksResult.value.blocks)}`,
                }
              }
              if (yielded > 0) return
            }
          } catch {
            // 回退逐页旧链路
          }
        }
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
          const rosettaUnit = await readRosettaUnitText(unit)
          const total = pdfDocRef.current?.numPages ?? numPages
          if (rosettaUnit) {
            return {
              label: rosettaUnit.label,
              text: formatPdfPageTextForAgent(page, total, rosettaUnit.text),
            }
          }
          const raw = await readPageText(page, { allowAutoOcr: agentAutoOcr() })
          return {
            label: unit.label || `第 ${page} 页`,
            text: formatPdfPageTextForAgent(page, total, raw),
          }
        } catch {
          return null
        }
      },
    })
  }, [filePath, isScannedPdf, readAgentPageText, readPageText, readRosettaUnitText])

  useEffect(() => {
    if (typeof window === 'undefined' || window.electronAPI?.e2ePdfStructure !== true) return
    window.__inkdownE2ePdfStructure = {
      readCurrentPage: async () => {
        const result = await readAgentPageTextWithSourceRef.current(pageNumRef.current)
        return { source: result.source, prefix: result.text.slice(0, 200) }
      },
      status: () => pdfStructureClient.getState(),
      inspectorStatus: () => pdfInspectorClient.getState(),
    }
    return () => {
      delete window.__inkdownE2ePdfStructure
    }
  }, [filePath])

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

  const selectionActions = useReaderSelectionActions({
    snapshotText: selectionSnapshot?.text,
    dimTextSelection,
    clearTextSelection,
    openAnnotateDialog: () => {
      setEditingNoteMark(null)
      setNoteDialogOpen(true)
      setSelectionToolbarPos(null)
    },
    hasSelection: () => selectionTransactionRef.current !== null || selectionSnapshot !== null,
    retainSelection: () => {
      if (selectionSnapshot) {
        selectionTransactionRef.current = selectionSnapshot
      }
    },
    saveHighlight: handleSaveAnnotation,
    onHighlightError: (cause) => {
      toast.error(cause instanceof Error ? cause.message : '添加高亮失败')
    },
  })

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

  const { handleExportNotes, handleExportAnkiCards } = useReaderExportMenu({
    marks,
    filePath,
    getToc: () => marksToc,
    getCurrentChapter: () => currentPdfChapter,
    resolveChapter: resolvePdfChapter,
  })

  const estimatedPageHeight = Math.max(120, scaledPageSize.height)
  const estimatedPageWidth = Math.max(120, scaledPageSize.width)

  const handleRosettaImport = useCallback(() => {
    if (!Number.isInteger(numPages) || numPages < 1) return
    const toc = resolveRosettaTocEntries({
      outlineUnits,
      ocrEntries: ocrTocEntries,
      pageOffset: tocPageOffset,
      pageCount: numPages,
    })
    rosettaImport.startImport({
      filePath,
      title: filePath.split(/[/\\]/).pop() || filePath,
      format: 'pdf',
      scale: pdfOcrScale,
      pageCount: numPages,
      toc,
    })
  }, [filePath, numPages, ocrTocEntries, outlineUnits, pdfOcrScale, rosettaImport, tocPageOffset])

  let rosettaExtraAction: ReactNode | null = null
  if (fileFingerprint) {
    if (rosettaImport.state === 'running') {
      const phaseLabel =
        rosettaImport.phase === 'import'
          ? '正在入库'
          : rosettaImport.totalPages > 0
            ? `全书识别中 ${rosettaImport.donePages}/${rosettaImport.totalPages}`
            : '准备中'
      rosettaExtraAction = (
        <span
          className="flex items-center gap-1 text-xs text-muted-foreground"
          title={`罗盘导入·${phaseLabel}（约数分钟；取消在阶段边界生效）`}
        >
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {phaseLabel}
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            title="取消导入（阶段边界生效）"
            aria-label="取消罗盘导入"
            onClick={() => rosettaImport.cancelImport()}
          >
            <X />
          </Button>
        </span>
      )
    } else if (rosettaImport.info) {
      rosettaExtraAction = (
        <span
          className="flex items-center gap-1 text-xs text-muted-foreground"
          title={`罗盘索引：${rosettaImport.info.chapters} 章 / ${rosettaImport.info.blocks} 块，AI 直接读库`}
        >
          <Database className="size-3.5" aria-hidden />
          ✓
        </span>
      )
    } else {
      rosettaExtraAction = (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs text-muted-foreground"
          title="全书解析后建章节块索引并落盘（原生页直提、扫描页识别），之后 AI 直接读库不再现场识别"
          onClick={() => void handleRosettaImport()}
        >
          <Database className="size-3.5" aria-hidden />
          罗盘
        </Button>
      )
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {showOcrBanner ? (
        <PdfOcrBanner
          mode={
            ocrRecognizing
              ? 'recognizing'
              : ocrTocEditorOpen
                ? 're-recognize-toc'
                : isScannedPdf
                  ? 'scanned-no-outline'
                  : 'mixed-no-outline'
          }
          tocPageFrom={tocPageFrom}
          tocPageTo={tocPageTo}
          tocPageOffset={tocPageOffset}
          onTocPageFromChange={setTocPageFrom}
          onTocPageToChange={setTocPageTo}
          onTocPageOffsetChange={setTocPageOffset}
          onSuggestOffset={() => void handleSuggestOffset()}
          suggestingOffset={suggestingOffset}
          onDetectTocPages={() => void handleDetectTocPages()}
          detectingTocPages={tocDetecting}
          busy={ocrTocBusy}
          onRecognize={() => void handleRecognizeToc()}
          onDismiss={() => {
            setOcrTocEditorOpen(false)
            setOcrBannerDismissed(true)
          }}
          entryCount={outlineSource === 'ocr' ? outlineUnits.length : undefined}
          extraActions={
            placedOcrTocNotice.bannerExtra ? (
              <span className="text-xs text-amber-900/80 dark:text-amber-100/80">
                {placedOcrTocNotice.bannerExtra}
              </span>
            ) : undefined
          }
        />
      ) : null}
      {placedOcrTocNotice.statusBar ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-950 dark:text-amber-100">
          <ScanText className="size-3.5 shrink-0 opacity-80" aria-hidden />
          <span className="min-w-0 flex-1">{placedOcrTocNotice.statusBar.message}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 text-xs"
            onClick={() => handleOpenOcrTocEditor()}
          >
            校正目录
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 text-xs"
            disabled={ocrTocBusy}
            onClick={() => void handleRecognizeToc()}
          >
            重新识别
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="shrink-0"
            aria-label="关闭提示"
            onClick={() => setOcrTocNotice(null)}
          >
            <X />
          </Button>
        </div>
      ) : null}
      <ReaderToolbarShell
        ready={ready}
        tocDisabled={!hasChapterToc}
        onTocToggle={() => {          setMarksOpen(false)
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
            {ocrTocAvailable && outlineSource === 'ocr' ? (
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-7 text-xs"
                disabled={ocrRecognizing || tocDetecting}
                onClick={() => setOcrTocEditorOpen(true)}
              >
                重新识别目录
              </Button>
            ) : null}
            {ocrTocAvailable && (ocrRecognizedCount > 0 || outlineSource === 'ocr') ? (
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
          <>
          {rosettaExtraAction}
          {isLoading ? (
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
          </>
        }
      />

      <ReaderContentShell
        filePath={filePath}
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
              busy={ocrTocBusy}
              onToggle={() => setTocOpen(false)}
              onSave={(entries) => void handleSaveOcrToc(entries)}
              onCancel={() => setOcrTocEditMode(false)}
              aiControl={
                <TocAiPolishControl
                  getOcrText={getTocOcrText}
                  getPageImages={getTocPageImages}
                  fileFingerprint={fileFingerprint}
                  baselineEntries={ocrTocEntries}
                  pageCount={numPages}
                  pageOffset={tocPageOffset}
                  onApply={(entries) => setOcrTocEntries(entries)}
                />
              }
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
          onCopy={selectionActions.handleCopy}
          onAnnotate={selectionActions.handleAnnotate}
          onHighlight={selectionActions.handleHighlight}
          onAddToChat={selectionActions.handleAddToChat}
          onAskAgent={selectionActions.handleAskAgent}
          onDismiss={selectionActions.handleDismiss}
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
