import { useEffect, useRef, useState } from 'react'
import ePub from 'epubjs'
import { ChevronLeft, ChevronRight, List, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PaneErrorBoundary } from '@/components/shared/PaneErrorBoundary'
import { useReaderBinary } from '@/hooks/useReaderBinary'
import { reportAppError } from '@/lib/report-error'
import type { AppError } from '@shared/errors'

interface TocItem {
  label: string
  href: string
}

interface EpubViewerProps {
  filePath: string
  theme: 'dark' | 'light'
}

export function EpubViewer({ filePath, theme }: EpubViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<ReturnType<ReturnType<typeof ePub>['renderTo']> | null>(null)
  const [toc, setToc] = useState<TocItem[]>([])
  const [tocOpen, setTocOpen] = useState(false)
  const [ready, setReady] = useState(false)

  const { data, isLoading, error } = useReaderBinary(filePath)

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
    setToc([])
    renditionRef.current = null

    const arrayBuffer = data.data.buffer.slice(
      data.data.byteOffset,
      data.data.byteOffset + data.data.byteLength,
    ) as ArrayBuffer
    const book = ePub(arrayBuffer)
    const rendition = book.renderTo(container, {
      width: '100%',
      height: '100%',
      spread: 'none',
    })
    renditionRef.current = rendition

    rendition.themes.register('dark', {
      body: { color: '#e4e4e7 !important', background: '#18181b !important' },
    })
    rendition.themes.register('light', {
      body: { color: '#18181b !important', background: '#ffffff !important' },
    })

    let cancelled = false

    void (async () => {
      try {
        await book.ready
        if (cancelled) return

        const navigation = await book.loaded.navigation
        setToc(
          (navigation.toc ?? []).map((item) => ({
            label: item.label.trim(),
            href: item.href,
          })),
        )
        await rendition.display()
        if (!cancelled) setReady(true)
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
      book.destroy()
      renditionRef.current = null
    }
  }, [data, filePath])

  useEffect(() => {
    renditionRef.current?.themes.select(theme)
  }, [theme, ready])

  const goPrev = () => {
    void renditionRef.current?.prev()
  }

  const goNext = () => {
    void renditionRef.current?.next()
  }

  const openChapter = (href: string) => {
    void renditionRef.current?.display(href)
    setTocOpen(false)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-border/60 px-3 py-2">
        <Button variant="ghost" size="icon-sm" disabled={!ready} onClick={goPrev}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" disabled={!ready} onClick={goNext}>
          <ChevronRight className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          disabled={!ready || toc.length === 0}
          onClick={() => setTocOpen((value) => !value)}
        >
          <List className="size-3.5" />
          目录
        </Button>
        {isLoading && <Loader2 className="ml-auto size-4 animate-spin text-muted-foreground" />}
      </div>

      {tocOpen && toc.length > 0 && (
        <div className="max-h-48 shrink-0 overflow-auto border-b border-border/60 bg-sidebar px-2 py-2">
          {toc.map((item) => (
            <button
              key={`${item.href}-${item.label}`}
              type="button"
              className="block w-full truncate rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              onClick={() => openChapter(item.href)}
            >
              {item.label || '未命名章节'}
            </button>
          ))}
        </div>
      )}

      <PaneErrorBoundary name="EPUB 阅读" filePath={filePath}>
        <div
          ref={containerRef}
          className={`relative min-h-0 flex-1 overflow-hidden ${theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}`}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              正在加载 EPUB…
            </div>
          )}
        </div>
      </PaneErrorBoundary>
    </div>
  )
}
