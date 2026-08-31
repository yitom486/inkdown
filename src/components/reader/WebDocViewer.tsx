import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { PaneErrorBoundary } from '@/components/shared/PaneErrorBoundary'
import { ReaderContentShell } from '@/components/reader/ReaderContentShell'
import { ReaderFooterNav } from '@/components/reader/ReaderFooterNav'
import { ReaderToolbarShell } from '@/components/reader/ReaderToolbarShell'
import { ReaderTypographyControls } from '@/components/reader/ReaderTypographyControls'
import { useWebDocPage } from '@/hooks/reader/useWebDocPage'
import { useWebDocToc } from '@/hooks/reader/useWebDocToc'
import { useReaderSidePanels } from '@/hooks/reader/useReaderSidePanels'
import { appApi } from '@/api/app-api'
import { queryKeys } from '@/api/query-keys'
import { extractDocumentText, extractViewportText } from '@/lib/agent/context/extract-dom-text'
import { registerReaderContent } from '@/lib/agent/context/reader-content-registry'
import { buildWebDocReaderDocument } from '@/lib/reader/web-doc-html'
import {
  formatWebDocTitle,
  resolveWebDocSiteId,
  resolveWebDocTocDiscoveryUrl,
} from '@/lib/reader/web-doc-site'
import { findWebDocFlatIndex, webDocTocEntriesToReaderUnits } from '@/lib/reader/web-doc-toc'
import {
  iterateWebDocUnits,
  primeWebDocAgentTextCache,
  readWebDocUnitByIndex,
} from '@/lib/reader/web-doc-agent-content'
import { reportAppError } from '@/lib/workspace/report-error'
import { useAppSettingsStore } from '@/stores/app-settings-store'
import { useReadingProgressStore } from '@/stores/reading-progress-store'
import { useReaderNavigationStore } from '@/stores/reader-navigation-store'
import { useWebDocStore } from '@/stores/web-doc-store'
import { cn } from '@/lib/utils'
import '@/styles/web-doc-viewer.css'

const WEB_PROGRESS_SAVE_MS = 400

interface WebDocViewerProps {
  pageUrl: string
  theme: 'dark' | 'light'
}

export function WebDocViewer({ pageUrl, theme }: WebDocViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const saveProgressTimerRef = useRef<number | null>(null)
  const queryClient = useQueryClient()
  const openPage = useWebDocStore((state) => state.openPage)
  const readerFontSize = useAppSettingsStore((state) => state.readerFontSize)
  const readerLineHeight = useAppSettingsStore((state) => state.readerLineHeight)
  const { data, isLoading, isFetching, error, refetch } = useWebDocPage(pageUrl)
  const siteId = useMemo(() => resolveWebDocSiteId(pageUrl), [pageUrl])
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
  const { tocOpen, toggleToc, closeToc } = useReaderSidePanels()
  const [iframeReady, setIframeReady] = useState(false)
  const ready = Boolean(data) && iframeReady

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

  useEffect(() => {
    useReaderNavigationStore.getState().beginSession(pageUrl, 'web')
    return () => {
      useReaderNavigationStore.getState().beginSession('', 'web')
    }
  }, [pageUrl])

  useEffect(() => {
    if (units.length === 0) return
    useReaderNavigationStore.getState().setUnits(units)
  }, [units])

  useEffect(() => {
    if (!data || units.length === 0) return
    useReaderNavigationStore.getState().syncWeb(units, pageUrl)
    useReaderNavigationStore.getState().setReady(true)
  }, [data, pageUrl, units])

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

  const bindIframeInteractions = useCallback(() => {
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    const win = iframe?.contentWindow
    if (!iframe || !doc || !win) return

    const onScroll = () => {
      if (saveProgressTimerRef.current != null) {
        window.clearTimeout(saveProgressTimerRef.current)
      }
      saveProgressTimerRef.current = window.setTimeout(() => {
        persistScrollProgress()
        saveProgressTimerRef.current = null
      }, WEB_PROGRESS_SAVE_MS)
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

    doc.addEventListener('scroll', onScroll, { passive: true })
    doc.addEventListener('click', onClick)
    restoreScrollProgress()

    return () => {
      doc.removeEventListener('scroll', onScroll)
      doc.removeEventListener('click', onClick)
    }
  }, [persistScrollProgress, restoreScrollProgress])

  useEffect(() => {
    setIframeReady(false)
    const iframe = iframeRef.current
    if (!iframe || !readerDocument) return

    const onLoad = () => {
      setIframeReady(true)
    }

    iframe.addEventListener('load', onLoad)
    iframe.srcdoc = readerDocument

    return () => {
      iframe.removeEventListener('load', onLoad)
    }
  }, [readerDocument])

  useEffect(() => {
    if (!iframeReady) return
    const text = extractDocumentText(iframeRef.current?.contentDocument)
    if (text.trim()) {
      primeWebDocAgentTextCache(pageUrl, text)
    }
    return bindIframeInteractions()
  }, [bindIframeInteractions, iframeReady, pageUrl])

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
        marksHidden
        onTocToggle={toggleToc}
        onMarksToggle={() => undefined}
        onAddBookmark={() => undefined}
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
        marksOpen={false}
        marks={[]}
        onSelectMark={() => undefined}
        onDeleteMark={() => undefined}
        onCloseMarks={() => undefined}
        tocOpen={tocOpen}
        units={units}
        currentUnitId={currentUnitId}
        onCloseToc={closeToc}
        onSelectUnit={(unit) => navigateToUrl(unit.href)}
      >
        {readerHost}
      </ReaderContentShell>

      <ReaderFooterNav ready={ready && units.length > 0} onPrevious={goPrevious} onNext={goNext} />
    </div>
  )
}
