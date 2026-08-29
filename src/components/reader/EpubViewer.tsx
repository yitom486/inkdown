import { useCallback, useEffect, useRef, useState } from 'react'
import ePub from 'epubjs'
import type Book from 'epubjs/types/book'
import { Loader2 } from 'lucide-react'
import { PaneErrorBoundary } from '@/components/shared/PaneErrorBoundary'
import { EpubMarkTooltip } from '@/components/reader/EpubMarkTooltip'
import { AnnotationNoteDialog } from '@/components/reader/AnnotationNoteDialog'
import { ReaderContentShell } from '@/components/reader/ReaderContentShell'
import { ReaderFooterNav } from '@/components/reader/ReaderFooterNav'
import { ReaderToolbarShell } from '@/components/reader/ReaderToolbarShell'
import { ReadingProgressRing } from '@/components/reader/ReadingProgressRing'
import { SelectionToolbar } from '@/components/reader/SelectionToolbar'
import { useReaderBinary } from '@/hooks/useReaderBinary'
import { useReaderSidePanels } from '@/hooks/useReaderSidePanels'
import { useReadingMarks } from '@/hooks/useReadingMarks'
import { scrollEpubChapterInRendition } from '@/lib/epub-scroll-toc'
import { navigateEpubToFlatIndex } from '@/lib/reader-flat-nav'
import {
  flattenEpubToc,
  pickInitialChapter,
  type EpubChapter,
} from '@/lib/epub-navigation'
import {
  buildEpubFileFingerprint,
  EPUB_LOCATIONS_CHUNK_SIZE,
} from '@/lib/epub-locations-cache'
import { getEpubThemeRules, applyEpubReadingLayout, applyEpubReadingLayoutToRendition } from '@/lib/epub-themes'
import {
  applyEpubMarkToRendition,
  findEpubNoteMarkAtPoint,
  injectReadingMarkStyles,
  removeEpubMarkFromRendition,
  replaceAllEpubMarksOnRendition,
  type EpubMarkHoverHandlers,
} from '@/lib/epub-reading-marks'
import { copyTextToClipboard, readEpubSelection, type EpubSelectionSnapshot } from '@/lib/epub-selection'
import {
  bindDocumentSelectionCollapse,
  bindOutsideReaderPointerDismiss,
  clearEpubRenditionSelections,
} from '@/lib/reader-selection-dismiss'
import { buildReadingFileFingerprint } from '@/lib/reading-file-fingerprint'
import { reportAppError } from '@/lib/report-error'
import { useReadingProgressStore } from '@/stores/reading-progress-store'
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
  const [hoveredMark, setHoveredMark] = useState<ReadingMark | null>(null)
  const [markTooltipPos, setMarkTooltipPos] = useState<{ x: number; y: number } | null>(null)

  const clearTextSelection = useCallback(() => {
    setSelectionSnapshot(null)
    setSelectionToolbarPos(null)
    clearEpubRenditionSelections(renditionRef.current)
  }, [])

  const scrollCleanupRef = useRef<(() => void) | null>(null)
  const selectionCleanupRef = useRef<(() => void) | null>(null)
  const markHoverCleanupRef = useRef<(() => void) | null>(null)
  const marksRef = useRef<ReadingMark[]>([])
  const hoveredMarkIdRef = useRef<string | null>(null)
  const reportLocationTimerRef = useRef<number | null>(null)
  const saveProgressTimerRef = useRef<number | null>(null)
  const pendingNavChapterRef = useRef<EpubChapter | null>(null)

  const { data, isLoading, error } = useReaderBinary(filePath)
  const { marks, createMark, deleteMark } = useReadingMarks(filePath)
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

  const applyTheme = useCallback(
    (rendition: NonNullable<typeof renditionRef.current>) => {
      rendition.themes.register('dark', getEpubThemeRules('dark'))
      rendition.themes.register('light', getEpubThemeRules('light'))
      rendition.themes.select(theme)
      rendition.themes.fontSize('100%')
    },
    [theme],
  )

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
  }, [theme])

  const addBookmarkAtCurrent = useCallback(async () => {
    const rendition = renditionRef.current
    if (!rendition || !fileFingerprint) return

    const location = rendition.currentLocation() as EpubLocation | null
    const cfi = location?.start?.cfi
    if (!cfi) {
      toast.error('无法获取当前阅读位置')
      return
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
    if (isOk(result)) {
      toast.success('已添加书签')
    }
  }, [nav, createMark, fileFingerprint, filePath])

  const handleSaveAnnotation = useCallback(
    async (note: string) => {
      if (!selectionSnapshot || !fileFingerprint) return

      const result = await createMark({
        filePath,
        fileFingerprint,
        kind: note ? 'note' : 'highlight',
        anchor: {
          format: 'epub',
          cfi: selectionSnapshot.cfiRange,
          cfiRange: selectionSnapshot.cfiRange,
          href: nav.current?.href,
          selectedText: selectionSnapshot.text,
        },
        excerpt: selectionSnapshot.text,
        note: note || undefined,
      })

      if (isOk(result) && renditionRef.current) {
        applyEpubMarkToRendition(renditionRef.current, result.value, theme)
        toast.success(note ? '已保存批注' : '已添加高亮')
      }

      clearTextSelection()
    },
    [nav, clearTextSelection, createMark, fileFingerprint, filePath, selectionSnapshot, theme],
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

  const applyReadingLayout = useCallback(
    (rendition: NonNullable<typeof renditionRef.current>) => {
      applyEpubReadingLayoutToRendition(rendition, theme)
    },
    [theme],
  )

  const bindScrollReporting = useCallback(
    (rendition: NonNullable<typeof renditionRef.current>) => {
      scrollCleanupRef.current?.()
      markHoverCleanupRef.current?.()

      const handler = (contents: { document: Document; window: Window; cfiFromRange?: (range: Range) => string }) => {
        injectReadingMarkStyles(contents.document, theme)
        applyEpubReadingLayout(contents.document, theme)
        requestAnimationFrame(() => {
          applyEpubReadingLayout(contents.document, theme)
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
          setSelectionSnapshot(null)
          setSelectionToolbarPos(null)
        }

        const onMouseUp = () => {
          window.setTimeout(() => {
            const snapshot = readEpubSelection(contents)
            if (!snapshot) {
              clearTextSelection()
              return
            }

            const frame = contents.window.frameElement as HTMLElement | null
            const frameRect = frame?.getBoundingClientRect()
            setSelectionSnapshot(snapshot)
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

        contents.document.addEventListener('mouseup', onMouseUp)
        selectionCleanupRef.current = () => {
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
    [clearTextSelection, markHoverHandlers, scheduleReportLocation, theme],
  )

  useEffect(() => {
    return bindOutsideReaderPointerDismiss((target) => {
      const container = containerRef.current
      if (!container) return false
      return container.contains(target)
    }, clearTextSelection)
  }, [clearTextSelection])

  useEffect(() => {
    if (!ready) return
    syncVisualMarks()
  }, [marks, ready, syncVisualMarks])

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
        syncVisualMarks()
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
    syncChapterNav,
    updateGlobalProgress,
  ])

  useEffect(() => {
    if (!renditionRef.current || !ready) return
    applyTheme(renditionRef.current)
    applyReadingLayout(renditionRef.current)
  }, [applyReadingLayout, applyTheme, ready, theme])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!ready) return
      if (!(event.altKey || event.metaKey)) return
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goToChapter(nav.previous, nav.previousIndex)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        goToChapter(nav.next, nav.nextIndex)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [nav.next, nav.previous, goToChapter, ready])

  const { currentUnitId } = useReaderNavTitles()

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

      {markTooltipPos && hoveredMark ? (
        <EpubMarkTooltip mark={hoveredMark} x={markTooltipPos.x} y={markTooltipPos.y} />
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
            clearTextSelection()
          }}
          onAnnotate={() => {
            setNoteDialogOpen(true)
            setSelectionToolbarPos(null)
          }}
          onDismiss={clearTextSelection}
        />
      ) : null}

      <AnnotationNoteDialog
        open={noteDialogOpen}
        excerpt={selectionSnapshot?.text}
        onOpenChange={setNoteDialogOpen}
        onSave={(note) => void handleSaveAnnotation(note)}
      />
    </div>
  )
}
