import { useCallback, useEffect, useRef, useState } from 'react'
import ePub from 'epubjs'
import type Book from 'epubjs/types/book'
import { ChevronLeft, ChevronRight, List, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PaneErrorBoundary } from '@/components/shared/PaneErrorBoundary'
import { EpubChapterOutline } from '@/components/reader/EpubChapterOutline'
import { ReadingProgressRing } from '@/components/reader/ReadingProgressRing'
import { useReaderBinary } from '@/hooks/useReaderBinary'
import {
  flattenEpubToc,
  pickInitialChapter,
  resolveChapterNav,
  type EpubChapter,
  type EpubChapterNavState,
} from '@/lib/epub-navigation'
import {
  buildEpubFileFingerprint,
  EPUB_LOCATIONS_CHUNK_SIZE,
} from '@/lib/epub-locations-cache'
import { getEpubThemeRules, applyEpubReadingLayout, applyEpubReadingLayoutToRendition } from '@/lib/epub-themes'
import { reportAppError } from '@/lib/report-error'
import { useReadingProgressStore } from '@/stores/reading-progress-store'
import { cn } from '@/lib/utils'
import type { AppError } from '@shared/errors'
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
  const [chapterNav, setChapterNav] = useState<EpubChapterNavState>({
    current: null,
    previous: null,
    next: null,
    currentIndex: -1,
  })
  const [tocOpen, setTocOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [globalProgress, setGlobalProgress] = useState(0)
  const scrollCleanupRef = useRef<(() => void) | null>(null)
  const reportLocationTimerRef = useRef<number | null>(null)
  const saveProgressTimerRef = useRef<number | null>(null)

  const { data, isLoading, error } = useReaderBinary(filePath)

  const applyTheme = useCallback(
    (rendition: NonNullable<typeof renditionRef.current>) => {
      rendition.themes.register('dark', getEpubThemeRules('dark'))
      rendition.themes.register('light', getEpubThemeRules('light'))
      rendition.themes.select(theme)
      rendition.themes.fontSize('100%')
    },
    [theme],
  )

  const syncChapterNav = useCallback((href?: string) => {
    const nextNav = resolveChapterNav(chaptersRef.current, href)
    setChapterNav(nextNav)
  }, [])

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

  const goToChapter = useCallback(
    (chapter: EpubChapter | null) => {
      if (!chapter || !renditionRef.current) return
      void renditionRef.current.display(chapter.href)
    },
    [],
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

      const handler = (contents: { document: Document; window: Window }) => {
        applyEpubReadingLayout(contents.document, theme)
        requestAnimationFrame(() => {
          applyEpubReadingLayout(contents.document, theme)
        })
        scrollCleanupRef.current?.()

        const onScroll = () => {
          scheduleReportLocation(rendition)
        }

        contents.document.addEventListener('scroll', onScroll, { passive: true })
        contents.window.addEventListener('scroll', onScroll, { passive: true })

        scrollCleanupRef.current = () => {
          contents.document.removeEventListener('scroll', onScroll)
          contents.window.removeEventListener('scroll', onScroll)
        }
      }

      rendition.hooks.content.register(handler)
    },
    [scheduleReportLocation, theme],
  )

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
    setChapterNav({ current: null, previous: null, next: null, currentIndex: -1 })
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
      syncChapterNav(location.start?.href)
      updateGlobalProgress(location)
      schedulePersistReadingProgress(location)
    }
    rendition.on('relocated', onRelocated)

    const onRendered = () => {
      requestAnimationFrame(() => {
        applyReadingLayout(rendition)
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

        let displayed = false
        if (savedProgress?.cfi) {
          try {
            await rendition.display(savedProgress.cfi)
            syncChapterNav(savedProgress.href)
            displayed = true
          } catch {
            displayed = false
          }
        }

        if (!displayed) {
          const initial = pickInitialChapter(flatChapters)
          if (initial) {
            await rendition.display(initial.href)
            syncChapterNav(initial.href)
          } else {
            await rendition.display()
            syncChapterNav()
          }
        }

        rendition.reportLocation()
        applyReadingLayout(rendition)
        if (!cancelled) setReady(true)

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
        goToChapter(chapterNav.previous)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        goToChapter(chapterNav.next)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [chapterNav.next, chapterNav.previous, goToChapter, ready])

  const currentTitle = chapterNav.current?.label ?? '—'

  const readerHost = (
    <PaneErrorBoundary name="EPUB 阅读" filePath={filePath}>
      <div
        ref={containerRef}
        className={cn(
          'epub-viewer-host relative h-full min-h-0 overflow-hidden',
          theme === 'dark' ? 'bg-[#18181b]' : 'bg-[#fafafa]',
        )}
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
      <div className="flex shrink-0 items-center gap-1 border-b border-border/60 px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          disabled={!ready || chapters.length === 0}
          onClick={() => setTocOpen((value) => !value)}
        >
          <List className="size-3.5" />
          目录
        </Button>
        <span className="ml-2 min-w-0 truncate text-xs text-muted-foreground">{currentTitle}</span>
        <div className="ml-auto flex items-center gap-2">
          {ready ? (
            <div className="relative text-muted-foreground">
              <ReadingProgressRing progress={globalProgress} />
            </div>
          ) : null}
          {isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {tocOpen && chapters.length > 0 ? (
          <aside className="flex w-[min(28%,320px)] min-w-[180px] shrink-0 flex-col border-r border-border/60">
            <EpubChapterOutline
              chapters={chapters}
              currentHref={chapterNav.current?.href}
              onToggle={() => setTocOpen(false)}
              onSelectChapter={goToChapter}
            />
          </aside>
        ) : null}
        <div className="min-h-0 min-w-0 flex-1">{readerHost}</div>
      </div>

      <footer className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-border/60 bg-sidebar px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-auto min-h-9 justify-start gap-1 px-2 py-1.5 text-left"
          disabled={!ready || !chapterNav.previous}
          onClick={() => goToChapter(chapterNav.previous)}
        >
          <ChevronLeft className="size-4 shrink-0" />
          <span className="min-w-0">
            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
              上一章
            </span>
            <span className="block truncate text-xs">{chapterNav.previous?.label ?? '—'}</span>
          </span>
        </Button>

        <div className="px-2 text-center">
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
            当前章节
          </span>
          <span className="block max-w-40 truncate text-xs font-medium">{currentTitle}</span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-auto min-h-9 justify-end gap-1 px-2 py-1.5 text-right"
          disabled={!ready || !chapterNav.next}
          onClick={() => goToChapter(chapterNav.next)}
        >
          <span className="min-w-0">
            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
              下一章
            </span>
            <span className="block truncate text-xs">{chapterNav.next?.label ?? '—'}</span>
          </span>
          <ChevronRight className="size-4 shrink-0" />
        </Button>
      </footer>
    </div>
  )
}
