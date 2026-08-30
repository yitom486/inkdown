import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ePub from 'epubjs'
import type Book from 'epubjs/types/book'
import { Loader2 } from 'lucide-react'
import { PaneErrorBoundary } from '@/components/shared/PaneErrorBoundary'
import { EpubMarkTooltip } from '@/components/reader/EpubMarkTooltip'
import { AnnotationNoteDialog } from '@/components/reader/AnnotationNoteDialog'
import { ReaderContentShell } from '@/components/reader/ReaderContentShell'
import { ReaderFooterNav } from '@/components/reader/ReaderFooterNav'
import { ReaderToolbarShell } from '@/components/reader/ReaderToolbarShell'
import { ReaderTypographyControls } from '@/components/reader/ReaderTypographyControls'
import { ReadingProgressRing } from '@/components/reader/ReadingProgressRing'
import { ReadingMarkPopover } from '@/components/reader/ReadingMarkPopover'
import { SelectionToolbar } from '@/components/reader/SelectionToolbar'
import { useReaderBinary } from '@/hooks/reader/useReaderBinary'
import { useReaderSidePanels } from '@/hooks/reader/useReaderSidePanels'
import { useReadingMarkInspector } from '@/hooks/reader/useReadingMarkInspector'
import { useReadingMarks } from '@/hooks/reader/useReadingMarks'
import { useDeferredReaderLayout } from '@/hooks/reader/useDeferredReaderLayout'
import { extractDocumentText, extractViewportText } from '@/lib/agent/context/extract-dom-text'
import { registerReaderContent } from '@/lib/agent/context/reader-content-registry'
import { registerReaderMarks } from '@/lib/agent/context/reader-marks-registry'
import { registerSelectionProvider, commitReaderSelection, clearReaderSelection, readSelectionText } from '@/lib/agent/context/reader-selection-registry'
import { focusAgentComposerOnReaderSelection, openAgentComposerToAskSelection, addSelectionMarkerToComposer } from '@/lib/agent/context/focus-agent-composer'
import { DEFAULT_HIGHLIGHT_COLOR } from '@/lib/reader/reading-mark-colors'
import { scrollEpubChapterInRendition } from '@/lib/reader/epub-scroll-toc'
import {
  collectEpubSpineItems,
  labelForSpineHref,
  loadEpubSpineText,
} from '@/lib/reader/epub-spine-text'
import { normalizeLoadKey } from '@/lib/reader/reader-viewport-nav'
import { navigateEpubToFlatIndex } from '@/lib/reader/reader-flat-nav'
import {
  flattenEpubToc,
  pickInitialChapter,
  type EpubChapter,
} from '@/lib/reader/epub-navigation'
import {
  buildEpubFileFingerprint,
  EPUB_LOCATIONS_CHUNK_SIZE,
} from '@/lib/reader/epub-locations-cache'
import { getEpubThemeRules, applyEpubReadingLayout, applyEpubReadingLayoutToRendition } from '@/lib/reader/epub-themes'
import {
  applyEpubMarkToRendition,
  applyEpubPendingSelectionHighlight,
  findEpubMarksAtPoint,
  findEpubNoteMarkAtPoint,
  injectReadingMarkStyles,
  removeEpubMarkFromRendition,
  removeEpubPendingSelectionHighlight,
  replaceAllEpubMarksOnRendition,
  type EpubMarkHoverHandlers,
} from '@/lib/reader/epub-reading-marks'
import { copyTextToClipboard, readEpubSelection, type EpubSelectionSnapshot } from '@/lib/reader/epub-selection'
import {
  bindDocumentSelectionCollapse,
  bindOutsideReaderPointerDismiss,
  clearEpubRenditionSelections,
} from '@/lib/reader/reader-selection-dismiss'
import { findMarkForSelection, isClickNotDrag } from '@/lib/reader/reading-mark-hit'
import { buildReadingFileFingerprint } from '@/lib/reader/reading-file-fingerprint'
import {
  resolveEpubChapter,
  tocFromEpubUnits,
  type ReadingNotesContentKind,
  type ReadingNotesScope,
} from '@/lib/reader/export-reading-notes'
import { saveReadingNotesExport } from '@/lib/reader/save-reading-notes-export'
import { reportAppError } from '@/lib/workspace/report-error'
import { useReadingProgressStore } from '@/stores/reading-progress-store'
import { useAppSettingsStore } from '@/stores/app-settings-store'
import { useReaderNavigationStore, useReaderNavTitles, isNavIntentLocked } from '@/stores/reader-navigation-store'
import { cn } from '@/lib/utils'
import type { AppError } from '@shared/core/errors'
import type { ReadingMark } from '@shared/types/reading-mark'
import { isOk } from '@shared/core/result'
import { toast } from 'sonner'
import '@/styles/epub-viewer.css'

interface EpubLocation {
  start?: {
    href?: string
    cfi?: string
    percentage?: number
  }
}

interface EpubViewerProps {
  filePath: string
  theme: 'dark' | 'light'
}

/** 全书位置索引粒度：越大进度越细，但首次生成越慢 */
const READING_PROGRESS_SAVE_MS = 400

function resolveGlobalProgress(book: Book | null, location: EpubLocation): number | null {
  const start = location.start
  if (!start) return null

  if (typeof start.percentage === 'number' && Number.isFinite(start.percentage)) {
    return Math.min(1, Math.max(0, start.percentage))
  }

  if (book && start.cfi) {
    const fromCfi = book.locations.percentageFromCfi(start.cfi)
    if (typeof fromCfi === 'number' && Number.isFinite(fromCfi)) {
      return Math.min(1, Math.max(0, fromCfi))
    }
  }

  return null
}

export function EpubViewer({ filePath, theme }: EpubViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bookRef = useRef<Book | null>(null)
  const renditionRef = useRef<ReturnType<ReturnType<typeof ePub>['renderTo']> | null>(null)
  const chaptersRef = useRef<EpubChapter[]>([])
  const [chapters, setChapters] = useState<EpubChapter[]>([])
  const nav = useReaderNavigationStore((state) => state.nav)
  const { tocOpen, marksOpen, toggleToc, toggleMarks, closeToc, closeMarks } = useReaderSidePanels()
  const [ready, setReady] = useState(false)
  const [globalProgress, setGlobalProgress] = useState(0)
  const [selectionSnapshot, setSelectionSnapshot] = useState<EpubSelectionSnapshot | null>(null)
  const [selectionToolbarPos, setSelectionToolbarPos] = useState<{ x: number; y: number } | null>(
    null,
  )
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [editingNoteMark, setEditingNoteMark] = useState<ReadingMark | null>(null)
  const pointerOriginRef = useRef<{ x: number; y: number } | null>(null)
  const [hoveredMark, setHoveredMark] = useState<ReadingMark | null>(null)
  const [markTooltipPos, setMarkTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const selectionSnapshotRef = useRef<EpubSelectionSnapshot | null>(null)
  selectionSnapshotRef.current = selectionSnapshot
  const readerFontSize = useAppSettingsStore((state) => state.readerFontSize)
  const readerLineHeight = useAppSettingsStore((state) => state.readerLineHeight)
  const typography = useMemo(
    () => ({ fontSize: readerFontSize, lineHeight: readerLineHeight }),
    [readerFontSize, readerLineHeight],
  )
  // 书籍初始化只应随文件变化。排版值通过 ref 提供给 epub.js，避免字号/主题
  // 改变时让初始化 effect 销毁并重新创建整本 book 与 rendition。
  const themeRef = useRef(theme)
  themeRef.current = theme
  const typographyRef = useRef(typography)
  typographyRef.current = typography
  const filePathRef = useRef(filePath)
  filePathRef.current = filePath

  const { data, isLoading, error } = useReaderBinary(filePath)
  const { marks, createMark, updateMark, deleteMark } = useReadingMarks(filePath)
  const inspector = useReadingMarkInspector(marks)
  const inspectorRef = useRef(inspector)
  inspectorRef.current = inspector

  const clearTextSelection = useCallback(() => {
    const pendingCfi = selectionSnapshotRef.current?.cfiRange
    if (pendingCfi && renditionRef.current) {
      removeEpubPendingSelectionHighlight(renditionRef.current, pendingCfi)
    }
    setSelectionSnapshot(null)
    setSelectionToolbarPos(null)
    clearReaderSelection()
    clearEpubRenditionSelections(renditionRef.current)
  }, [])

  /** 收起高亮、工具栏与标记浮层，保留 sticky 供 Agent 读取 */
  const dimTextSelection = useCallback(() => {
    if (noteDialogOpen) return
    setSelectionToolbarPos(null)
    clearEpubRenditionSelections(renditionRef.current)
    inspectorRef.current.close()
  }, [noteDialogOpen])

  const showPendingSelectionHighlight = useCallback(() => {
    const snapshot = selectionSnapshotRef.current
    const rendition = renditionRef.current
    if (!snapshot?.cfiRange || !rendition || editingNoteMark) return
    applyEpubPendingSelectionHighlight(rendition, snapshot.cfiRange, themeRef.current)
    clearEpubRenditionSelections(rendition)
  }, [editingNoteMark])

  const scrollCleanupRef = useRef<(() => void) | null>(null)
  const selectionCleanupRef = useRef<(() => void) | null>(null)
  const markHoverCleanupRef = useRef<(() => void) | null>(null)
  const marksRef = useRef<ReadingMark[]>([])
  const hoveredMarkIdRef = useRef<string | null>(null)
  const reportLocationTimerRef = useRef<number | null>(null)
  const saveProgressTimerRef = useRef<number | null>(null)
  const pendingNavChapterRef = useRef<EpubChapter | null>(null)
  marksRef.current = marks
  const fileFingerprint = data
    ? buildReadingFileFingerprint(filePath, data.data.byteLength)
    : ''

  useEffect(() => {
    useReaderNavigationStore.getState().beginSession(filePath, 'epub')
    return () => {
      useReaderNavigationStore.getState().beginSession('', 'epub')
    }
  }, [filePath])

  const applyTheme = useCallback((rendition: NonNullable<typeof renditionRef.current>) => {
    const currentTypography = typographyRef.current
    rendition.themes.register('dark', getEpubThemeRules('dark', currentTypography))
    rendition.themes.register('light', getEpubThemeRules('light', currentTypography))
    rendition.themes.select(themeRef.current)
    rendition.themes.fontSize(`${currentTypography.fontSize}px`)
  }, [])

  const syncChapterNav = useCallback(
    (location?: EpubLocation | string, flatIndex?: number) => {
      const units = chaptersRef.current
      if (typeof flatIndex === 'number' && flatIndex >= 0 && units.length > 0) {
        useReaderNavigationStore.getState().syncFlatIndex(flatIndex)
        return
      }

      if (isNavIntentLocked(useReaderNavigationStore.getState().navIntent)) {
        return
      }

      const rendition = renditionRef.current
      if (rendition && units.length > 0) {
        useReaderNavigationStore.getState().syncEpubRendition(units, rendition)
        const syncedIndex = useReaderNavigationStore.getState().nav.flatIndex
        if (syncedIndex >= 0) return
      }

      const hint =
        typeof location === 'string'
          ? { href: location }
          : {
              href: location?.start?.href,
              cfi: location?.start?.cfi,
            }
      useReaderNavigationStore.getState().syncEpub(units, hint, flatIndex)
    },
    [],
  )

  const updateGlobalProgress = useCallback((location: EpubLocation) => {
    const next = resolveGlobalProgress(bookRef.current, location)
    if (next !== null) {
      setGlobalProgress(next)
    }
  }, [])

  const persistReadingProgress = useCallback(
    (location: EpubLocation) => {
      const cfi = location.start?.cfi
      if (!cfi) return

      const percentage = resolveGlobalProgress(bookRef.current, location) ?? undefined
      useReadingProgressStore.getState().saveEpubProgress(filePath, {
        cfi,
        href: location.start?.href,
        percentage,
      })
    },
    [filePath],
  )

  const schedulePersistReadingProgress = useCallback(
    (location: EpubLocation) => {
      if (saveProgressTimerRef.current !== null) {
        window.clearTimeout(saveProgressTimerRef.current)
      }
      saveProgressTimerRef.current = window.setTimeout(() => {
        saveProgressTimerRef.current = null
        persistReadingProgress(location)
      }, READING_PROGRESS_SAVE_MS)
    },
    [persistReadingProgress],
  )

  const scheduleReportLocation = useCallback((rendition: NonNullable<typeof renditionRef.current>) => {
    if (reportLocationTimerRef.current !== null) {
      window.clearTimeout(reportLocationTimerRef.current)
    }
    reportLocationTimerRef.current = window.setTimeout(() => {
      reportLocationTimerRef.current = null
      rendition.reportLocation()
    }, 120)
  }, [])

  const goToChapter = useCallback((chapter: EpubChapter | null, flatIndex?: number) => {
    if (!chapter || !renditionRef.current) return
    const resolvedIndex =
      typeof flatIndex === 'number' && flatIndex >= 0
        ? flatIndex
        : chaptersRef.current.findIndex(
            (item) => item.href === chapter.href && item.label === chapter.label,
          )
    if (resolvedIndex < 0) return

    const pending = navigateEpubToFlatIndex(
      chaptersRef.current,
      resolvedIndex,
      renditionRef.current,
      (index) => useReaderNavigationStore.getState().syncFlatIndex(index),
    )
    pendingNavChapterRef.current = pending
  }, [])

  const markHoverHandlers = useCallback((): EpubMarkHoverHandlers => {
    return {
      onEnter: (mark, anchor) => {
        setHoveredMark(mark)
        setMarkTooltipPos({
          x: anchor.left + anchor.width / 2,
          y: anchor.top,
        })
      },
      onLeave: () => {
        setHoveredMark(null)
        setMarkTooltipPos(null)
      },
    }
  }, [])

  const syncVisualMarks = useCallback(() => {
    const rendition = renditionRef.current
    if (!rendition) return
    replaceAllEpubMarksOnRendition(rendition, marksRef.current, theme)
    // 批注窗打开时重绘会冲掉挂起选区，补回一层
    if (noteDialogOpen && !editingNoteMark) {
      const cfi = selectionSnapshotRef.current?.cfiRange
      if (cfi) applyEpubPendingSelectionHighlight(rendition, cfi, theme)
    }
  }, [editingNoteMark, noteDialogOpen, theme])

  const scheduleVisualMarkLayout = useDeferredReaderLayout(() => {
    hoveredMarkIdRef.current = null
    setHoveredMark(null)
    setMarkTooltipPos(null)
    syncVisualMarks()
  })

  const addBookmarkAtCurrent = useCallback(async () => {
    const rendition = renditionRef.current
    if (!rendition || !fileFingerprint) {
      throw new Error('无法获取当前阅读位置')
    }

    const location = rendition.currentLocation() as EpubLocation | null
    const cfi = location?.start?.cfi
    if (!cfi) {
      toast.error('无法获取当前阅读位置')
      throw new Error('无法获取当前阅读位置')
    }

    const result = await createMark({
      filePath,
      fileFingerprint,
      kind: 'bookmark',
      anchor: {
        format: 'epub',
        cfi,
        href: location?.start?.href,
      },
      label: nav.current?.label ?? '书签',
    })
    if (!isOk(result)) {
      throw new Error(result.error.message || '创建书签失败')
    }
    toast.success('已添加书签')
    return result.value
  }, [nav, createMark, fileFingerprint, filePath])

  const handleSaveAnnotation = useCallback(
    async (note: string, color = DEFAULT_HIGHLIGHT_COLOR) => {
      const snapshot = selectionSnapshotRef.current
      if (!snapshot || !fileFingerprint) {
        throw new Error('当前没有可用选区，请先划选文本')
      }

      const existing = findMarkForSelection(marks, {
        format: 'epub',
        text: snapshot.text,
        cfiRange: snapshot.cfiRange,
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
        if (renditionRef.current) {
          applyEpubMarkToRendition(renditionRef.current, result.value, theme)
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
          format: 'epub',
          cfi: snapshot.cfiRange,
          cfiRange: snapshot.cfiRange,
          href: nav.current?.href,
          selectedText: snapshot.text,
        },
        excerpt: snapshot.text,
        note: note || undefined,
        color,
      })

      if (!isOk(result)) {
        throw new Error(result.error.message || '创建批注失败')
      }

      if (renditionRef.current) {
        applyEpubMarkToRendition(renditionRef.current, result.value, theme)
        toast.success(note ? '已保存批注' : '已添加高亮')
      }

      clearTextSelection()
      return result.value
    },
    [nav, clearTextSelection, createMark, fileFingerprint, filePath, marks, theme, updateMark],
  )

  const handleSelectMark = useCallback((mark: ReadingMark) => {
    if (mark.anchor.format !== 'epub' || !renditionRef.current) return
    const cfi = mark.anchor.cfiRange ?? mark.anchor.cfi
    void renditionRef.current.display(cfi)
  }, [])

  const handleDeleteMark = useCallback(
    async (mark: ReadingMark) => {
      if (renditionRef.current) {
        removeEpubMarkFromRendition(renditionRef.current, mark)
      }
      await deleteMark(mark.id)
      toast.success('已删除')
    },
    [deleteMark],
  )

  const applyReadingLayout = useCallback((rendition: NonNullable<typeof renditionRef.current>) => {
    applyEpubReadingLayoutToRendition(rendition, themeRef.current, typographyRef.current)
  }, [])

  const bindScrollReporting = useCallback(
    (rendition: NonNullable<typeof renditionRef.current>) => {
      scrollCleanupRef.current?.()
      markHoverCleanupRef.current?.()

      const handler = (contents: { document: Document; window: Window; cfiFromRange?: (range: Range) => string }) => {
        injectReadingMarkStyles(contents.document, themeRef.current)
        applyEpubReadingLayout(contents.document, themeRef.current, typographyRef.current)
        requestAnimationFrame(() => {
          applyEpubReadingLayout(contents.document, themeRef.current, typographyRef.current)
        })
        scrollCleanupRef.current?.()
        selectionCleanupRef.current?.()
        markHoverCleanupRef.current?.()

        const onScroll = () => {
          scheduleReportLocation(rendition)
          if (isNavIntentLocked(useReaderNavigationStore.getState().navIntent)) {
            return
          }
          const location = rendition.currentLocation() as EpubLocation | null
          const spineHref = location?.start?.href
          if (spineHref && chaptersRef.current.length > 0) {
            useReaderNavigationStore
              .getState()
              .syncEpubViewport(chaptersRef.current, contents.document, spineHref)
          }
        }

        contents.document.addEventListener('scroll', onScroll, { passive: true })
        contents.window.addEventListener('scroll', onScroll, { passive: true })
        requestAnimationFrame(() => onScroll())

        scrollCleanupRef.current = () => {
          contents.document.removeEventListener('scroll', onScroll)
          contents.window.removeEventListener('scroll', onScroll)
        }

        const collapseSelectionUi = () => {
          setSelectionToolbarPos(null)
        }

        const onMouseDown = (event: MouseEvent) => {
          pointerOriginRef.current = { x: event.clientX, y: event.clientY }
        }

        const onMouseUp = (event: MouseEvent) => {
          window.setTimeout(() => {
            const frame = contents.window.frameElement as HTMLElement | null
            const frameRect = frame?.getBoundingClientRect()
            const clientX = (frameRect?.left ?? 0) + event.clientX
            const clientY = (frameRect?.top ?? 0) + event.clientY

            if (isClickNotDrag(pointerOriginRef.current, event)) {
              const host = containerRef.current
              if (host) {
                const hits = findEpubMarksAtPoint(host, clientX, clientY)
                  .map((hit) => marksRef.current.find((item) => item.id === hit.markId))
                  .filter((item): item is ReadingMark => Boolean(item))
                if (hits.length > 0) {
                  clearEpubRenditionSelections(renditionRef.current)
                  setSelectionToolbarPos(null)
                  inspectorRef.current.openAt(hits, clientX, clientY)
                  return
                }
              }
            }

            const snapshot = readEpubSelection(contents)
            if (!snapshot) {
              // 点空白（无选区）时收起标记浮层；此前只在出现新选区时 close，导致浮层粘住
              if (isClickNotDrag(pointerOriginRef.current, event)) {
                inspectorRef.current.close()
              }
              return
            }

            inspectorRef.current.close()
            setSelectionSnapshot(snapshot)
            commitReaderSelection(filePathRef.current, snapshot.text)
            focusAgentComposerOnReaderSelection()
            setSelectionToolbarPos({
              x: (frameRect?.left ?? 0) + snapshot.rect.left + snapshot.rect.width / 2,
              y: (frameRect?.top ?? 0) + snapshot.rect.top,
            })
          }, 10)
        }

        const unbindSelectionCollapse = bindDocumentSelectionCollapse(
          contents.document,
          contents.window,
          collapseSelectionUi,
        )

        contents.document.addEventListener('mousedown', onMouseDown)
        contents.document.addEventListener('mouseup', onMouseUp)
        selectionCleanupRef.current = () => {
          contents.document.removeEventListener('mousedown', onMouseDown)
          contents.document.removeEventListener('mouseup', onMouseUp)
          unbindSelectionCollapse()
        }

        let hoverRaf = 0
        const onMouseMove = (event: MouseEvent) => {
          if (hoverRaf !== 0) return
          hoverRaf = window.requestAnimationFrame(() => {
            hoverRaf = 0
            const host = containerRef.current
            if (!host) return

            const frame = contents.window.frameElement as HTMLElement | null
            const frameRect = frame?.getBoundingClientRect()
            const clientX = (frameRect?.left ?? 0) + event.clientX
            const clientY = (frameRect?.top ?? 0) + event.clientY

            const hit = findEpubNoteMarkAtPoint(host, clientX, clientY)
            if (!hit) {
              if (hoveredMarkIdRef.current !== null) {
                hoveredMarkIdRef.current = null
                markHoverHandlers().onLeave()
              }
              return
            }

            if (hoveredMarkIdRef.current === hit.markId) return

            const mark = marksRef.current.find((item) => item.id === hit.markId)
            if (!mark?.note?.trim()) return

            hoveredMarkIdRef.current = hit.markId
            markHoverHandlers().onEnter(mark, hit.element.getBoundingClientRect())
          })
        }

        contents.document.addEventListener('mousemove', onMouseMove, { passive: true })
        contents.document.addEventListener('mouseleave', () => {
          hoveredMarkIdRef.current = null
          markHoverHandlers().onLeave()
        })

        markHoverCleanupRef.current = () => {
          contents.document.removeEventListener('mousemove', onMouseMove)
          if (hoverRaf !== 0) {
            window.cancelAnimationFrame(hoverRaf)
            hoverRaf = 0
          }
        }
      }

      rendition.hooks.content.register(handler)
    },
    [markHoverHandlers, scheduleReportLocation],
  )

  useEffect(() => {
    return bindOutsideReaderPointerDismiss((target) => {
      const container = containerRef.current
      if (!container) return false
      return container.contains(target)
    }, () => {
      if (noteDialogOpen) return
      dimTextSelection()
    })
  }, [dimTextSelection, noteDialogOpen])

  useEffect(() => {
    return () => {
      clearReaderSelection()
    }
  }, [filePath])

  useEffect(() => {
    if (!ready) return
    scheduleVisualMarkLayout()
  }, [marks, ready, readerFontSize, readerLineHeight, scheduleVisualMarkLayout, theme])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !ready) return
    const observer = new ResizeObserver(() => scheduleVisualMarkLayout())
    observer.observe(container)
    return () => observer.disconnect()
  }, [ready, scheduleVisualMarkLayout])

  useEffect(() => {
    if (error && typeof error === 'object' && error !== null && 'code' in error) {
      reportAppError(error as AppError)
    }
  }, [error])

  useEffect(() => {
    const container = containerRef.current
    if (!data || !container) return

    container.innerHTML = ''
    setReady(false)
    setChapters([])
    setGlobalProgress(0)
    chaptersRef.current = []
    bookRef.current = null
    renditionRef.current = null

    const arrayBuffer = data.data.buffer.slice(
      data.data.byteOffset,
      data.data.byteOffset + data.data.byteLength,
    ) as ArrayBuffer
    const book = ePub(arrayBuffer)
    bookRef.current = book

    const rendition = book.renderTo(container, {
      width: '100%',
      height: '100%',
      spread: 'none',
      flow: 'scrolled-doc',
    })
    renditionRef.current = rendition
    applyTheme(rendition)
    bindScrollReporting(rendition)

    const onRelocated = (location: EpubLocation) => {
      syncChapterNav(location)
      updateGlobalProgress(location)
      schedulePersistReadingProgress(location)
    }
    rendition.on('relocated', onRelocated)

    const onRendered = () => {
      requestAnimationFrame(() => {
        applyReadingLayout(rendition)
        const pendingChapter = pendingNavChapterRef.current
        if (pendingChapter) {
          scrollEpubChapterInRendition(rendition, pendingChapter)
          pendingNavChapterRef.current = null
          useReaderNavigationStore.getState().clearNavIntent()
        }
        if (
          chaptersRef.current.length > 0 &&
          !isNavIntentLocked(useReaderNavigationStore.getState().navIntent)
        ) {
          useReaderNavigationStore.getState().syncEpubRendition(chaptersRef.current, rendition)
        }
        requestAnimationFrame(() => {
          applyReadingLayout(rendition)
          scheduleVisualMarkLayout()
        })
      })
    }
    rendition.on('rendered', onRendered)

    let cancelled = false

    void (async () => {
      try {
        await book.ready
        if (cancelled) return

        const savedProgress = useReadingProgressStore.getState().getEpubProgress(filePath)
        if (savedProgress?.percentage != null) {
          setGlobalProgress(savedProgress.percentage)
        }

        const navigation = await book.loaded.navigation
        const flatChapters = flattenEpubToc(
          (navigation.toc ?? []).map((item) => ({
            label: item.label,
            href: item.href,
            subitems: item.subitems?.map((sub) => ({
              label: sub.label,
              href: sub.href,
              subitems: sub.subitems,
            })),
          })),
        )
        chaptersRef.current = flatChapters
        setChapters(flatChapters)
        useReaderNavigationStore.getState().setUnits(flatChapters)

        let displayed = false
        if (savedProgress?.cfi) {
          try {
            await rendition.display(savedProgress.cfi)
            syncChapterNav({
              start: {
                href: savedProgress.href,
                cfi: savedProgress.cfi,
                percentage: savedProgress.percentage,
              },
            })
            displayed = true
          } catch {
            displayed = false
          }
        }

        if (!displayed) {
          const initial = pickInitialChapter(flatChapters)
          if (initial) {
            const initialIndex = flatChapters.findIndex(
              (item) => item.href === initial.href && item.label === initial.label,
            )
            await rendition.display(initial.href)
            syncChapterNav(initial.href, initialIndex >= 0 ? initialIndex : undefined)
          } else {
            await rendition.display()
            syncChapterNav()
          }
        }

        rendition.reportLocation()
        applyReadingLayout(rendition)
        if (!cancelled) {
          setReady(true)
          useReaderNavigationStore.getState().setReady(true)
        }

        const fingerprint = buildEpubFileFingerprint(filePath, data.data.byteLength)
        const cachedLocations = useReadingProgressStore.getState().getEpubLocations(filePath)
        const canUseCachedLocations =
          cachedLocations?.fingerprint === fingerprint &&
          cachedLocations.chunkSize === EPUB_LOCATIONS_CHUNK_SIZE &&
          cachedLocations.locationsJson.length > 0

        if (canUseCachedLocations) {
          book.locations.load(cachedLocations.locationsJson)
          rendition.reportLocation()
          return
        }

        void book.locations.generate(EPUB_LOCATIONS_CHUNK_SIZE).then(() => {
          if (cancelled) return
          const locationsJson = book.locations.save()
          if (locationsJson && locationsJson !== 'null') {
            useReadingProgressStore.getState().saveEpubLocations(filePath, {
              fingerprint,
              chunkSize: EPUB_LOCATIONS_CHUNK_SIZE,
              locationsJson,
            })
          }
          rendition.reportLocation()
        })
      } catch (cause) {
        if (!cancelled) {
          reportAppError({
            code: 'FILE_READ_ERROR',
            message: cause instanceof Error ? cause.message : 'EPUB 加载失败',
          })
        }
      }
    })()

    return () => {
      cancelled = true
      if (reportLocationTimerRef.current !== null) {
        window.clearTimeout(reportLocationTimerRef.current)
        reportLocationTimerRef.current = null
      }
      if (saveProgressTimerRef.current !== null) {
        window.clearTimeout(saveProgressTimerRef.current)
        saveProgressTimerRef.current = null
      }
      try {
        const current = rendition.currentLocation() as EpubLocation | null
        if (current) {
          persistReadingProgress(current)
        }
      } catch {
        // rendition 已销毁时忽略
      }
      scrollCleanupRef.current?.()
      scrollCleanupRef.current = null
      selectionCleanupRef.current?.()
      selectionCleanupRef.current = null
      rendition.off('relocated', onRelocated)
      rendition.off('rendered', onRendered)
      book.destroy()
      bookRef.current = null
      renditionRef.current = null
    }
  }, [
    applyReadingLayout,
    applyTheme,
    bindScrollReporting,
    data,
    filePath,
    persistReadingProgress,
    schedulePersistReadingProgress,
    scheduleVisualMarkLayout,
    syncChapterNav,
    updateGlobalProgress,
  ])

  // 主题变化可能需要切换 epub.js 的主题注册；它不参与书籍初始化。
  useEffect(() => {
    const rendition = renditionRef.current
    if (!rendition || !ready) return
    applyTheme(rendition)
    applyReadingLayout(rendition)
  }, [applyReadingLayout, applyTheme, ready, theme])

  // 字号与行距只更新现有章节 iframe，不重新 select 主题，更不会重建 book。
  useEffect(() => {
    const rendition = renditionRef.current
    if (!rendition || !ready) return
    rendition.themes.fontSize(`${typographyRef.current.fontSize}px`)
    applyReadingLayout(rendition)
  }, [applyReadingLayout, ready, readerFontSize, readerLineHeight])

  useEffect(() => {
    return registerReaderContent({
      filePath,
      getCurrentText: () => {
        const contents = renditionRef.current?.getContents() as unknown
        const list: unknown[] = Array.isArray(contents) ? contents : contents ? [contents] : []
        return list
          .map((item) => extractDocumentText((item as { document?: Document }).document))
          .join('\n\n')
      },
      getViewportText: () => {
        const contents = renditionRef.current?.getContents() as unknown
        const list: unknown[] = Array.isArray(contents) ? contents : contents ? [contents] : []
        return list
          .map((item) => extractViewportText((item as { document?: Document }).document))
          .join('\n\n')
      },
      iterateUnits: async function* () {
        const book = bookRef.current
        if (!book) return
        for (const item of collectEpubSpineItems(book)) {
          const text = await loadEpubSpineText(book, item)
          if (text) yield { label: labelForSpineHref(chaptersRef.current, item.href), text }
        }
      },
      getUnitByIndex: async (flatIndex) => {
        const book = bookRef.current
        const chapter = chaptersRef.current[flatIndex]
        if (!book || !chapter) return null
        const target = normalizeLoadKey(chapter.href)
        const matched = collectEpubSpineItems(book).find(
          (spine) => normalizeLoadKey(spine.href) === target,
        )
        if (!matched) return null
        const text = await loadEpubSpineText(book, matched)
        if (!text.trim()) return null
        return { label: chapter.label, text }
      },
    })
  }, [filePath])

  useEffect(() => {
    return registerSelectionProvider({
      filePath,
      getSelectionText: () => readSelectionText(filePath),
    })
  }, [filePath])

  useEffect(() => {
    return registerReaderMarks({
      filePath,
      createBookmark: () => addBookmarkAtCurrent(),
      createNoteFromSelection: (note) => handleSaveAnnotation(note),
    })
  }, [addBookmarkAtCurrent, filePath, handleSaveAnnotation])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!ready) return
      if (!(event.altKey || event.metaKey)) return
      // 按键瞬间读 store，避免闭包里的 nav / index 过期
      const { nav: currentNav } = useReaderNavigationStore.getState()
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goToChapter(currentNav.previous, currentNav.previousIndex)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        goToChapter(currentNav.next, currentNav.nextIndex)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goToChapter, ready])

  const { currentUnitId } = useReaderNavTitles()

  const handleExportNotes = useCallback(
    (contentKind: ReadingNotesContentKind, scope: ReadingNotesScope) => {
      const toc = tocFromEpubUnits(chapters)
      const currentKey = currentUnitId ? normalizeLoadKey(currentUnitId) : ''
      const currentHits = toc.filter((entry) => entry.matchKey === currentKey)
      const currentChapter =
        currentHits.length > 0
          ? currentHits.reduce((best, item) => (item.level >= best.level ? item : best))
          : null
      void saveReadingNotesExport({
        marks,
        toc,
        contentKind,
        scope,
        currentChapter: scope === 'chapter' ? currentChapter : null,
        filePath,
        resolveChapter: resolveEpubChapter,
      })
    },
    [chapters, currentUnitId, filePath, marks],
  )

  const readerHost = (
    <PaneErrorBoundary name="EPUB 阅读" filePath={filePath}>
      <div
        ref={containerRef}
        className={cn(
          'epub-viewer-host relative h-full min-h-0 overflow-hidden',
          theme === 'dark' ? 'bg-[#18181b]' : 'bg-[#fafafa]',
        )}
        data-theme={theme}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            正在加载 EPUB…
          </div>
        )}
      </div>
    </PaneErrorBoundary>
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ReaderToolbarShell
        ready={ready}
        tocDisabled={chapters.length === 0}
        onTocToggle={toggleToc}
        onMarksToggle={toggleMarks}
        onAddBookmark={() => void addBookmarkAtCurrent()}
        trailing={
          <>
            <ReaderTypographyControls disabled={!ready} />
            {ready ? (
              <div className="relative text-muted-foreground">
                <ReadingProgressRing progress={globalProgress} />
              </div>
            ) : null}
            {isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
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
        marksToc={tocFromEpubUnits(chapters)}
        marksCurrentChapterKey={currentUnitId ? normalizeLoadKey(currentUnitId) : undefined}
        marksResolveChapter={resolveEpubChapter}
        tocOpen={tocOpen}
        units={chapters}
        currentUnitId={currentUnitId}
        onCloseToc={closeToc}
        onSelectUnit={(unit) => {
          const index = chapters.findIndex(
            (item) => item.href === unit.href && item.label === unit.label,
          )
          goToChapter(unit, index >= 0 ? index : undefined)
        }}
      >
        {readerHost}
      </ReaderContentShell>

      <ReaderFooterNav
        ready={ready}
        onPrevious={() => goToChapter(nav.previous, nav.previousIndex)}
        onNext={() => goToChapter(nav.next, nav.nextIndex)}
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
        filePath={filePath}
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
              // 重点上加批注 → 仍是重点；纯批注保持批注
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
