import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { PaneErrorBoundary } from '@/components/shared/PaneErrorBoundary'
import { AnnotationNoteDialog } from '@/components/reader/AnnotationNoteDialog'
import { EpubMarkTooltip } from '@/components/reader/EpubMarkTooltip'
import { ReaderContentShell } from '@/components/reader/ReaderContentShell'
import { ReaderFooterNav } from '@/components/reader/ReaderFooterNav'
import { ReaderToolbarShell } from '@/components/reader/ReaderToolbarShell'
import { ReaderTypographyControls } from '@/components/reader/ReaderTypographyControls'
import { ReadingMarkPopover } from '@/components/reader/ReadingMarkPopover'
import { SelectionToolbar } from '@/components/reader/SelectionToolbar'
import { useWebDocPage } from '@/hooks/reader/useWebDocPage'
import { useWebDocToc } from '@/hooks/reader/useWebDocToc'
import { useReaderSidePanels } from '@/hooks/reader/useReaderSidePanels'
import { useReadingMarkInspector } from '@/hooks/reader/useReadingMarkInspector'
import { useReadingMarks } from '@/hooks/reader/useReadingMarks'
import { useDeferredReaderLayout } from '@/hooks/reader/useDeferredReaderLayout'
import { appApi } from '@/api/app-api'
import { queryKeys } from '@/api/query-keys'
import { extractDocumentText, extractViewportText } from '@/lib/agent/context/extract-dom-text'
import { focusAgentComposerOnReaderSelection, openAgentComposerToAskSelection, addSelectionMarkerToComposer } from '@/lib/agent/context/focus-agent-composer'
import { registerReaderContent } from '@/lib/agent/context/reader-content-registry'
import { registerReaderMarks } from '@/lib/agent/context/reader-marks-registry'
import { registerSelectionProvider, commitReaderSelection, clearReaderSelection } from '@/lib/agent/context/reader-selection-registry'
import { DEFAULT_HIGHLIGHT_COLOR } from '@/lib/reader/reading-mark-colors'
import { findMarkForSelection, isClickNotDrag } from '@/lib/reader/reading-mark-hit'
import { buildWebDocReaderDocument } from '@/lib/reader/web-doc-html'
import {
  buildWebDocFileFingerprint,
  formatWebDocTitle,
  resolveWebDocDocumentId,
  resolveWebDocSiteId,
  resolveWebDocTocDiscoveryUrl,
} from '@/lib/reader/web-doc-site'
import { findWebDocFlatIndex, normalizeWebDocNavUrl, webDocTocEntriesToReaderUnits } from '@/lib/reader/web-doc-toc'
import {
  iterateWebDocUnits,
  primeWebDocAgentTextCache,
  readWebDocUnitByIndex,
} from '@/lib/reader/web-doc-agent-content'
import { readMobiSelection, buildMobiSnapshotFromRange } from '@/lib/reader/mobi-selection'
import { findTextRangeInRoot } from '@/lib/reader/excerpt-text-match'
import { waitForDom } from '@/lib/reader/wait-for-dom'
import type { CreateMarkAtParams } from '@/lib/agent/context/reader-marks-registry'
import {
  applyMobiPendingSelectionHighlight,
  findMobiMarksAtPoint,
  findMobiNoteMarkAtPoint,
  removeMobiPendingSelectionHighlight,
  renderWebMarkOverlays,
} from '@/lib/reader/mobi-reading-marks'
import { injectMobiMarkStyles } from '@/lib/reader/reader-mark-geometry'
import {
  bindDocumentSelectionCollapse,
  bindOutsideReaderPointerDismiss,
  clearWindowSelection,
} from '@/lib/reader/reader-selection-dismiss'
import { copyTextToClipboard, type PdfSelectionSnapshot } from '@/lib/reader/pdf-selection'
import { applyCopyButtonFeedback, getCodeBlockTextFromCopyButton } from '@/lib/preview/code-block-copy'
import {
  resolveWebChapter,
  tocFromWebUnits,
  type ReadingNotesContentKind,
  type ReadingNotesScope,
} from '@/lib/reader/export-reading-notes'
import { saveReadingNotesExport } from '@/lib/reader/save-reading-notes-export'
import { reportAppError } from '@/lib/workspace/report-error'
import { useAppSettingsStore } from '@/stores/app-settings-store'
import { useReadingProgressStore } from '@/stores/reading-progress-store'
import { useReaderNavigationStore } from '@/stores/reader-navigation-store'
import { useWebDocStore } from '@/stores/web-doc-store'
import { cn } from '@/lib/utils'
import { isOk } from '@shared/core/result'
import type { ReadingMark } from '@shared/types/reading-mark'
import { toast } from 'sonner'
import '@/styles/web-doc-viewer.css'

const WEB_PROGRESS_SAVE_MS = 400

interface WebDocViewerProps {
  pageUrl: string
  theme: 'dark' | 'light'
}

export function WebDocViewer({ pageUrl, theme }: WebDocViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const saveProgressTimerRef = useRef<number | null>(null)
  const themeRef = useRef(theme)
  themeRef.current = theme
  const pageUrlRef = useRef(pageUrl)
  pageUrlRef.current = pageUrl
  const queryClient = useQueryClient()
  const openPage = useWebDocStore((state) => state.openPage)
  const readerFontSize = useAppSettingsStore((state) => state.readerFontSize)
  const readerLineHeight = useAppSettingsStore((state) => state.readerLineHeight)
  const { data, isLoading, isFetching, error, refetch } = useWebDocPage(pageUrl)
  const siteId = useMemo(() => resolveWebDocSiteId(pageUrl), [pageUrl])
  const documentId = useMemo(() => resolveWebDocDocumentId(pageUrl, siteId), [pageUrl, siteId])
  const normalizedPageUrl = useMemo(() => normalizeWebDocNavUrl(pageUrl), [pageUrl])
  const fileFingerprint = useMemo(() => buildWebDocFileFingerprint(documentId), [documentId])
  const tocDiscoveryUrl = useMemo(
    () => resolveWebDocTocDiscoveryUrl(pageUrl, siteId),
    [pageUrl, siteId],
  )
  const { data: tocData } = useWebDocToc(tocDiscoveryUrl)
  const units = useMemo(
    () => webDocTocEntriesToReaderUnits(tocData?.entries ?? []),
    [tocData?.entries],
  )
  const unitsRef = useRef(units)
  unitsRef.current = units
  const { tocOpen, marksOpen, toggleToc, toggleMarks, closeToc, closeMarks } = useReaderSidePanels()
  const [iframeReady, setIframeReady] = useState(false)
  const ready = Boolean(data) && iframeReady
  const { marks, createMark, updateMark, deleteMark } = useReadingMarks(documentId)
  const marksRef = useRef(marks)
  marksRef.current = marks
  const inspector = useReadingMarkInspector(marks)
  const inspectorRef = useRef(inspector)
  inspectorRef.current = inspector
  const [selectionSnapshot, setSelectionSnapshot] = useState<PdfSelectionSnapshot | null>(null)
  const [selectionToolbarPos, setSelectionToolbarPos] = useState<{ x: number; y: number } | null>(null)
  const selectionSnapshotRef = useRef(selectionSnapshot)
  selectionSnapshotRef.current = selectionSnapshot
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [editingNoteMark, setEditingNoteMark] = useState<ReadingMark | null>(null)
  const [hoveredMark, setHoveredMark] = useState<ReadingMark | null>(null)
  const [markTooltipPos, setMarkTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const hoveredMarkIdRef = useRef<string | null>(null)
  const pointerOriginRef = useRef<{ x: number; y: number } | null>(null)
  const frameCleanupRef = useRef<(() => void) | null>(null)
  const nav = useReaderNavigationStore((state) => state.nav)

  const readerDocument = useMemo(() => {
    if (!data) return ''
    return buildWebDocReaderDocument(data.content, theme, {
      fontSize: readerFontSize,
      lineHeight: readerLineHeight,
    })
  }, [data, readerFontSize, readerLineHeight, theme])

  const displayTitle = useMemo(
    () => formatWebDocTitle(pageUrl, data?.content.title),
    [data?.content.title, pageUrl],
  )

  const clearTextSelection = useCallback(() => {
    clearWindowSelection(iframeRef.current?.contentWindow ?? undefined)
    setSelectionSnapshot(null)
    setSelectionToolbarPos(null)
    clearReaderSelection()
    const body = iframeRef.current?.contentDocument?.body
    if (body) removeMobiPendingSelectionHighlight(body)
  }, [])

  const dimTextSelection = useCallback(() => {
    setSelectionToolbarPos(null)
    clearWindowSelection(iframeRef.current?.contentWindow ?? undefined)
  }, [])

  const showPendingSelectionHighlight = useCallback(() => {
    const body = iframeRef.current?.contentDocument?.body
    const rects = selectionSnapshotRef.current?.rects
    if (!body || !rects?.length) return
    applyMobiPendingSelectionHighlight(body, rects, themeRef.current)
  }, [])

  const syncWebMarkOverlays = useCallback(
    (doc: Document, url: string) => {
      if (!doc.body) return
      injectMobiMarkStyles(doc, themeRef.current)
      renderWebMarkOverlays(doc.body, marksRef.current, url, themeRef.current)
      if (noteDialogOpen && !editingNoteMark) {
        const rects = selectionSnapshotRef.current?.rects
        if (rects?.length) {
          applyMobiPendingSelectionHighlight(doc.body, rects, themeRef.current)
        }
      }
    },
    [editingNoteMark, noteDialogOpen],
  )

  const scheduleWebMarkLayout = useDeferredReaderLayout(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc?.body) return
    hoveredMarkIdRef.current = null
    setHoveredMark(null)
    setMarkTooltipPos(null)
    syncWebMarkOverlays(doc, pageUrlRef.current)
  })

  useEffect(() => {
    useReaderNavigationStore.getState().beginSession(documentId, 'web')
    return () => {
      useReaderNavigationStore.getState().beginSession('', 'web')
    }
  }, [documentId])

  useEffect(() => {
    if (units.length === 0) return
    useReaderNavigationStore.getState().setUnits(units)
  }, [units])

  useEffect(() => {
    if (!data || units.length === 0) return
    useReaderNavigationStore.getState().syncWeb(units, pageUrl)
    useReaderNavigationStore.getState().setReady(true)
  }, [data, pageUrl, units])

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc?.body || !iframeReady) return
    scheduleWebMarkLayout()
  }, [iframeReady, marks, normalizedPageUrl, readerFontSize, readerLineHeight, scheduleWebMarkLayout, theme])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !ready) return
    const observer = new ResizeObserver(() => scheduleWebMarkLayout())
    observer.observe(iframe)
    return () => observer.disconnect()
  }, [ready, scheduleWebMarkLayout])

  const navigateToUrl = useCallback(
    (targetUrl: string, flatIndex?: number) => {
      const currentUnits = unitsRef.current
      const resolvedIndex =
        typeof flatIndex === 'number' ? flatIndex : findWebDocFlatIndex(currentUnits, targetUrl)
      if (resolvedIndex >= 0) {
        useReaderNavigationStore.getState().syncWeb(currentUnits, targetUrl, resolvedIndex)
      }
      openPage(targetUrl)
    },
    [openPage],
  )

  const goPrevious = useCallback(() => {
    const previous = useReaderNavigationStore.getState().nav.previous
    if (!previous) return
    navigateToUrl(previous.href, useReaderNavigationStore.getState().nav.previousIndex)
  }, [navigateToUrl])

  const goNext = useCallback(() => {
    const next = useReaderNavigationStore.getState().nav.next
    if (!next) return
    navigateToUrl(next.href, useReaderNavigationStore.getState().nav.nextIndex)
  }, [navigateToUrl])

  const persistScrollProgress = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    const root = doc?.documentElement
    if (!root) return

    const scrollHeight = root.scrollHeight - root.clientHeight
    if (scrollHeight <= 0) return

    const scrollRatio = root.scrollTop / scrollHeight
    useReadingProgressStore.getState().saveWebProgress(pageUrl, { scrollRatio })
  }, [pageUrl])

  const restoreScrollProgress = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    const root = doc?.documentElement
    if (!root) return

    const saved = useReadingProgressStore.getState().getWebProgress(pageUrl)
    if (!saved) return

    const scrollHeight = root.scrollHeight - root.clientHeight
    if (scrollHeight <= 0) return

    root.scrollTop = scrollHeight * saved.scrollRatio
  }, [pageUrl])

  const addPageBookmark = useCallback(async () => {
    const result = await createMark({
      filePath: documentId,
      fileFingerprint,
      kind: 'bookmark',
      anchor: { format: 'web', url: normalizedPageUrl },
      label: nav.current?.label ?? data?.content.title ?? '书签',
    })
    if (!isOk(result)) {
      throw new Error(result.error.message || '创建书签失败')
    }
    toast.success('已添加书签')
    return result.value
  }, [createMark, data?.content.title, documentId, fileFingerprint, nav.current?.label, normalizedPageUrl])

  const handleSaveAnnotation = useCallback(
    async (note: string, color = DEFAULT_HIGHLIGHT_COLOR) => {
      const snapshot = selectionSnapshotRef.current
      if (!snapshot) {
        throw new Error('当前没有可用选区，请先划选文本')
      }

      const existing = findMarkForSelection(marks, {
        format: 'web',
        text: snapshot.text,
        pageUrl: normalizedPageUrl,
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
        const doc = iframeRef.current?.contentDocument
        if (doc?.body) syncWebMarkOverlays(doc, pageUrl)
        clearTextSelection()
        return result.value
      }

      const result = await createMark({
        filePath: documentId,
        fileFingerprint,
        kind: note ? 'note' : 'highlight',
        anchor: {
          format: 'web',
          url: normalizedPageUrl,
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

      marksRef.current = [...marksRef.current, result.value]
      toast.success(note ? '已保存批注' : '已添加高亮')
      const doc = iframeRef.current?.contentDocument
      if (doc?.body) syncWebMarkOverlays(doc, pageUrl)
      clearTextSelection()
      return result.value
    },
    [clearTextSelection, createMark, documentId, fileFingerprint, marks, normalizedPageUrl, pageUrl, syncWebMarkOverlays, updateMark],
  )

  const handleCreateMarkAt = useCallback(
    async ({ excerpt, note, flatIndex }: CreateMarkAtParams) => {
      const navState = useReaderNavigationStore.getState().nav
      if (typeof flatIndex === 'number' && flatIndex >= 0 && flatIndex !== navState.flatIndex) {
        const unit = unitsRef.current[flatIndex]
        if (!unit) throw new Error('章节索引无效')
        await new Promise<void>((resolve) => {
          const iframe = iframeRef.current
          if (!iframe) {
            resolve()
            return
          }
          const onLoad = () => {
            iframe.removeEventListener('load', onLoad)
            resolve()
          }
          iframe.addEventListener('load', onLoad)
          navigateToUrl(unit.href, flatIndex)
          window.setTimeout(() => {
            iframe.removeEventListener('load', onLoad)
            resolve()
          }, 4000)
        })
      }

      const snapshot = await waitForDom(() => {
        const doc = iframeRef.current?.contentDocument
        const body = doc?.body
        if (!doc || !body) return null
        const range = findTextRangeInRoot(body, excerpt)
        if (!range) return null
        return buildMobiSnapshotFromRange(doc, range, excerpt)
      })
      if (!snapshot) {
        throw new Error('未在当前页找到该摘录，请打开对应章节后重试')
      }

      selectionSnapshotRef.current = snapshot
      setSelectionSnapshot(snapshot)
      return handleSaveAnnotation(note)
    },
    [handleSaveAnnotation, navigateToUrl],
  )

  const bindIframeFrame = useCallback(
    (iframe: HTMLIFrameElement) => {
      frameCleanupRef.current?.()

      const doc = iframe.contentDocument
      const win = iframe.contentWindow
      if (!doc || !win || !doc.body) return

      scheduleWebMarkLayout()
      const frameRect = iframe.getBoundingClientRect()

      const onMouseDown = (event: MouseEvent) => {
        pointerOriginRef.current = { x: event.clientX, y: event.clientY }
      }

      const onMouseUp = (event: MouseEvent) => {
        window.setTimeout(() => {
          if (isClickNotDrag(pointerOriginRef.current, event)) {
            const hits = findMobiMarksAtPoint(doc, event.clientX, event.clientY)
              .map((hit) => marksRef.current.find((item) => item.id === hit.markId))
              .filter((item): item is ReadingMark => Boolean(item))
            if (hits.length > 0) {
              clearWindowSelection(win)
              setSelectionToolbarPos(null)
              inspectorRef.current.openAt(
                hits,
                frameRect.left + event.clientX,
                frameRect.top + event.clientY,
              )
              return
            }
          }

          const snapshot = readMobiSelection(doc, win)
          if (!snapshot) {
            if (isClickNotDrag(pointerOriginRef.current, event)) {
              inspectorRef.current.close()
            }
            return
          }

          inspectorRef.current.close()
          setSelectionSnapshot(snapshot)
          commitReaderSelection(documentId, snapshot.text)
          focusAgentComposerOnReaderSelection()
          setSelectionToolbarPos({
            x: frameRect.left + snapshot.toolbarX,
            y: frameRect.top + snapshot.toolbarY,
          })
        }, 10)
      }

      const onScroll = () => {
        if (saveProgressTimerRef.current != null) {
          window.clearTimeout(saveProgressTimerRef.current)
        }
        saveProgressTimerRef.current = window.setTimeout(() => {
          persistScrollProgress()
          saveProgressTimerRef.current = null
        }, WEB_PROGRESS_SAVE_MS)
      }

      const onCopyCodeBlock = (event: MouseEvent) => {
        const target = event.target
        if (!(target instanceof Element)) return

        const button = target.closest<HTMLButtonElement>('.code-block-copy')
        if (!button) return

        event.preventDefault()
        event.stopPropagation()

        const text = getCodeBlockTextFromCopyButton(button)
        if (!text) return

        void copyTextToClipboard(text).then((ok) => {
          if (!ok) return
          applyCopyButtonFeedback(button)
          toast.success('代码已复制')
        })
      }

      const onClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement | null
        const anchor = target?.closest('a')
        if (!(anchor instanceof HTMLAnchorElement)) return

        const href = anchor.getAttribute('href')?.trim()
        if (!href || href.startsWith('#')) return

        event.preventDefault()
        void appApi.openExternal(href)
      }

      const onSelectionChange = bindDocumentSelectionCollapse(doc, win, () => {
        setSelectionToolbarPos(null)
      })

      let hoverRaf = 0
      const onMouseMove = (event: MouseEvent) => {
        if (hoverRaf !== 0) return
        hoverRaf = window.requestAnimationFrame(() => {
          hoverRaf = 0
          const hit = findMobiNoteMarkAtPoint(doc, event.clientX, event.clientY)
          if (!hit) {
            if (hoveredMarkIdRef.current !== null) {
              hoveredMarkIdRef.current = null
              setHoveredMark(null)
              setMarkTooltipPos(null)
            }
            return
          }

          if (hoveredMarkIdRef.current === hit.markId) return

          const mark = marksRef.current.find((item) => item.id === hit.markId)
          if (!mark?.note?.trim()) return

          hoveredMarkIdRef.current = hit.markId
          const rect = hit.element.getBoundingClientRect()
          setHoveredMark(mark)
          setMarkTooltipPos({
            x: frameRect.left + rect.left + rect.width / 2,
            y: frameRect.top + rect.top,
          })
        })
      }

      doc.addEventListener('click', onCopyCodeBlock)
      doc.addEventListener('mousedown', onMouseDown)
      doc.addEventListener('mouseup', onMouseUp)
      doc.addEventListener('scroll', onScroll, { passive: true })
      doc.addEventListener('click', onClick)
      doc.addEventListener('mousemove', onMouseMove, { passive: true })
      restoreScrollProgress()

      frameCleanupRef.current = () => {
        doc.removeEventListener('click', onCopyCodeBlock)
        doc.removeEventListener('mousedown', onMouseDown)
        doc.removeEventListener('mouseup', onMouseUp)
        doc.removeEventListener('scroll', onScroll)
        doc.removeEventListener('click', onClick)
        doc.removeEventListener('mousemove', onMouseMove)
        onSelectionChange()
        if (hoverRaf !== 0) window.cancelAnimationFrame(hoverRaf)
      }
    },
    [documentId, persistScrollProgress, restoreScrollProgress, scheduleWebMarkLayout],
  )

  useEffect(() => {
    setIframeReady(false)
    const iframe = iframeRef.current
    if (!iframe || !readerDocument) return

    const onLoad = () => {
      setIframeReady(true)
      bindIframeFrame(iframe)
      const text = extractDocumentText(iframe.contentDocument)
      if (text.trim()) {
        primeWebDocAgentTextCache(pageUrl, text)
      }
    }

    iframe.addEventListener('load', onLoad)
    iframe.srcdoc = readerDocument

    return () => {
      iframe.removeEventListener('load', onLoad)
      frameCleanupRef.current?.()
      frameCleanupRef.current = null
    }
  }, [bindIframeFrame, pageUrl, readerDocument])

  useEffect(() => {
    return () => {
      if (saveProgressTimerRef.current != null) {
        window.clearTimeout(saveProgressTimerRef.current)
      }
      persistScrollProgress()
    }
  }, [pageUrl, persistScrollProgress])

  useEffect(() => {
    return registerReaderContent({
      filePath: pageUrl,
      getCurrentText: () => extractDocumentText(iframeRef.current?.contentDocument),
      getViewportText: () => extractViewportText(iframeRef.current?.contentDocument),
      getUnitByIndex: async (flatIndex) => {
        if (unitsRef.current.length === 0) return null
        try {
          return await readWebDocUnitByIndex(unitsRef.current, flatIndex)
        } catch {
          return null
        }
      },
      iterateUnits: async function* () {
        if (unitsRef.current.length === 0) return
        yield* iterateWebDocUnits(unitsRef.current)
      },
    })
  }, [pageUrl])

  useEffect(() => {
    return registerReaderMarks({
      filePath: documentId,
      createBookmark: () => addPageBookmark(),
      createNoteFromSelection: (note) => handleSaveAnnotation(note),
      createMarkAt: (params) => handleCreateMarkAt(params),
      navigateToFlatIndex: (index) => {
        const unit = unitsRef.current[index]
        if (unit?.href) navigateToUrl(unit.href, index)
      },
    })
  }, [
    addPageBookmark,
    documentId,
    handleCreateMarkAt,
    handleSaveAnnotation,
    navigateToUrl,
  ])

  useEffect(() => {
    return registerSelectionProvider({
      filePath: documentId,
      getSelectionText: () => {
        const cached = selectionSnapshotRef.current?.text?.trim()
        if (cached) return cached
        const doc = iframeRef.current?.contentDocument
        const win = iframeRef.current?.contentWindow
        if (!doc || !win) return null
        return readMobiSelection(doc, win)?.text?.trim() || null
      },
    })
  }, [documentId])

  useEffect(() => {
    return () => {
      clearReaderSelection()
    }
  }, [documentId])

  useEffect(() => {
    return bindOutsideReaderPointerDismiss((target) => {
      const iframe = iframeRef.current
      if (!iframe) return false
      return target === iframe || iframe.contains(target)
    }, () => {
      if (noteDialogOpen) return
      dimTextSelection()
    })
  }, [dimTextSelection, noteDialogOpen])

  useEffect(() => {
    if (error) {
      reportAppError(error)
    }
  }, [error])

  const handleReload = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.webDocPage(pageUrl) })
    void refetch()
  }

  const handleOpenInBrowser = () => {
    void appApi.openExternal(pageUrl)
  }

  const handleSelectMark = useCallback(
    (mark: ReadingMark) => {
      if (mark.anchor.format === 'web') {
        navigateToUrl(mark.anchor.url)
      }
    },
    [navigateToUrl],
  )

  const handleDeleteMark = useCallback(
    async (mark: ReadingMark) => {
      await deleteMark(mark.id)
      toast.success('已删除')
    },
    [deleteMark],
  )

  const handleExportNotes = useCallback(
    (contentKind: ReadingNotesContentKind, scope: ReadingNotesScope) => {
      const toc = tocFromWebUnits(units)
      const currentHits = toc.filter((item) => item.matchKey === normalizedPageUrl)
      const currentChapter =
        scope === 'chapter'
          ? currentHits.reduce((best, item) => ((item.level ?? 0) >= (best.level ?? 0) ? item : best), currentHits[0] ?? null)
          : null
      void saveReadingNotesExport({
        marks,
        toc,
        contentKind,
        scope,
        currentChapter: scope === 'chapter' ? currentChapter : null,
        filePath: documentId,
        resolveChapter: resolveWebChapter,
      })
    },
    [documentId, marks, normalizedPageUrl, units],
  )

  const currentUnitId = useMemo(() => {
    const flatIndex = findWebDocFlatIndex(units, pageUrl)
    if (flatIndex >= 0) return units[flatIndex]?.href
    return pageUrl
  }, [pageUrl, units])

  const readerHost = (
    <PaneErrorBoundary name="在线文档" filePath={pageUrl}>
      <div className={cn('web-doc-viewer-host relative h-full min-h-0', `theme-${theme}`)} data-theme={theme}>
        {isLoading && !data ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            正在加载页面…
          </div>
        ) : null}
        {error && !data ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {error.message}
          </div>
        ) : null}
        <iframe
          ref={iframeRef}
          title={displayTitle}
          className={cn('h-full w-full', !readerDocument && 'hidden')}
          sandbox="allow-same-origin"
        />
      </div>
    </PaneErrorBoundary>
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ReaderToolbarShell
        ready={ready}
        tocDisabled={units.length === 0}
        onTocToggle={toggleToc}
        onMarksToggle={toggleMarks}
        onAddBookmark={() => void addPageBookmark()}
        trailing={
          <>
            <ReaderTypographyControls disabled={!ready} />
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={isLoading || isFetching}
              onClick={handleReload}
              title="重新加载"
            >
              <RefreshCw className={cn('size-4', isFetching && 'animate-spin')} />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={handleOpenInBrowser} title="在浏览器中打开">
              <ExternalLink className="size-4" />
            </Button>
            {(isLoading || isFetching) && !data ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : null}
          </>
        }
      />

      <ReaderContentShell
        marksOpen={marksOpen}
        marks={marks}
        onSelectMark={handleSelectMark}
        onDeleteMark={(mark) => void handleDeleteMark(mark)}
        onCloseMarks={closeMarks}
        onExportNotes={handleExportNotes}
        marksToc={tocFromWebUnits(units)}
        marksCurrentChapterKey={normalizedPageUrl}
        marksResolveChapter={resolveWebChapter}
        tocOpen={tocOpen}
        units={units}
        currentUnitId={currentUnitId}
        onCloseToc={closeToc}
        onSelectUnit={(unit) => navigateToUrl(unit.href)}
      >
        {readerHost}
      </ReaderContentShell>

      <ReaderFooterNav ready={ready && units.length > 0} onPrevious={goPrevious} onNext={goNext} />

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
            setEditingNoteMark(null)
            setNoteDialogOpen(true)
            setSelectionToolbarPos(null)
            showPendingSelectionHighlight()
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
        filePath={documentId}
        fileFingerprint={fileFingerprint}
        aiAssist
        excerpt={editingNoteMark?.excerpt ?? selectionSnapshot?.text}
        initialNote={editingNoteMark?.note ?? ''}
        title={editingNoteMark ? '编辑批注' : '添加批注'}
        onOpenChange={(open) => {
          setNoteDialogOpen(open)
          if (!open) {
            const wasEditing = Boolean(editingNoteMark)
            setEditingNoteMark(null)
            if (!wasEditing) clearTextSelection()
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
            })
            return
          }
          void handleSaveAnnotation(note)
        }}
      />
    </div>
  )
}
