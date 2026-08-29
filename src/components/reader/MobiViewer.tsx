import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { initKindleFile, type KindleBook } from '@/lib/kindle-init'
import { Loader2 } from 'lucide-react'
import { PaneErrorBoundary } from '@/components/shared/PaneErrorBoundary'
import { AnnotationNoteDialog } from '@/components/reader/AnnotationNoteDialog'
import { EpubMarkTooltip } from '@/components/reader/EpubMarkTooltip'
import { ReaderContentShell } from '@/components/reader/ReaderContentShell'
import { ReaderFooterNav } from '@/components/reader/ReaderFooterNav'
import { ReaderToolbarShell } from '@/components/reader/ReaderToolbarShell'
import { SelectionToolbar } from '@/components/reader/SelectionToolbar'
import { useReaderBinary } from '@/hooks/useReaderBinary'
import { useReaderSidePanels } from '@/hooks/useReaderSidePanels'
import { useReadingMarks } from '@/hooks/useReadingMarks'
import type { ReaderUnit } from '@/lib/reader-navigation'
import { resolveWheelPageTurn } from '@/lib/reader-wheel-navigation'
import {
  buildMobiChapterDocument,
  isMobiChapterReadable,
  normalizeMobiChapterHtml,
} from '@/lib/mobi-chapter-html'
import { injectMobiMarkStyles } from '@/lib/reader-mark-geometry'
import { findMobiNoteMarkAtPoint, renderMobiMarkOverlays } from '@/lib/mobi-reading-marks'
import {
  buildMobiChapterList,
  decodeMobiTocHref,
  encodeMobiTocHref,
  isTocLikeMobiChapter,
  pickReadableMobiChapterCandidates,
  type MobiChapterItem,
} from '@/lib/mobi-navigation'
import {
  findLastFlatIndexById,
  findNextDistinctLoadTarget,
  findPreviousDistinctLoadTarget,
} from '@/lib/reader-chapter-nav'
import { readMobiSelection } from '@/lib/mobi-selection'
import {
  bindDocumentSelectionCollapse,
  bindOutsideReaderPointerDismiss,
  clearWindowSelection,
} from '@/lib/reader-selection-dismiss'
import {
  copyTextToClipboard,
  type PdfSelectionSnapshot,
} from '@/lib/pdf-selection'
import { buildReadingFileFingerprint } from '@/lib/reading-file-fingerprint'
import { reportAppError } from '@/lib/report-error'
import { useReadingProgressStore } from '@/stores/reading-progress-store'
import { useReaderNavigationStore, useReaderNavTitles } from '@/stores/reader-navigation-store'
import { cn } from '@/lib/utils'
import type { AppError } from '@shared/core/errors'
import type { ReadingMark } from '@shared/types/reading-mark'
import { isOk } from '@shared/core/result'
import { toast } from 'sonner'
import '@/styles/mobi-viewer.css'

interface MobiViewerProps {
  filePath: string
  theme: 'dark' | 'light'
}

export function MobiViewer({ filePath, theme }: MobiViewerProps) {
  const mobiRef = useRef<KindleBook | null>(null)
  const currentChapterIdRef = useRef<string | undefined>(undefined)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const themeRef = useRef(theme)
  themeRef.current = theme
  const chapterCleanupRef = useRef<(() => void) | null>(null)
  const marksRef = useRef<ReadingMark[]>([])
  const hoveredMarkIdRef = useRef<string | null>(null)
  const wheelCooldownRef = useRef(false)

  const [chapters, setChapters] = useState<MobiChapterItem[]>([])
  const [currentChapterId, setCurrentChapterId] = useState<string>()
  const [currentTocFlatIndex, setCurrentTocFlatIndex] = useState(-1)
  const chaptersRef = useRef<MobiChapterItem[]>([])
  const [chapterDocHtml, setChapterDocHtml] = useState('')
  const [chapterLoading, setChapterLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const { tocOpen, marksOpen, toggleToc, toggleMarks, closeToc, closeMarks } = useReaderSidePanels()
  const [selectionSnapshot, setSelectionSnapshot] = useState<PdfSelectionSnapshot | null>(null)
  const [selectionToolbarPos, setSelectionToolbarPos] = useState<{ x: number; y: number } | null>(
    null,
  )
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [hoveredMark, setHoveredMark] = useState<ReadingMark | null>(null)
  const [markTooltipPos, setMarkTooltipPos] = useState<{ x: number; y: number } | null>(null)

  const clearTextSelection = useCallback(() => {
    setSelectionSnapshot(null)
    setSelectionToolbarPos(null)
    clearWindowSelection(iframeRef.current?.contentWindow ?? null)
  }, [])

  const { data, isLoading, error } = useReaderBinary(filePath)
  const { marks, createMark, deleteMark } = useReadingMarks(filePath)
  marksRef.current = marks

  const fileFingerprint = data
    ? buildReadingFileFingerprint(filePath, data.data.byteLength)
    : ''

  chaptersRef.current = chapters

  const nav = useReaderNavigationStore((state) => state.nav)

  const outlineUnits: ReaderUnit[] = useMemo(
    () =>
      chapters.map((chapter, index) => ({
        label: chapter.label,
        href: encodeMobiTocHref(index),
        level: chapter.level,
      })),
    [chapters],
  )

  useEffect(() => {
    useReaderNavigationStore.getState().beginSession(filePath, 'mobi')
    return () => {
      useReaderNavigationStore.getState().beginSession('', 'mobi')
    }
  }, [filePath])

  useEffect(() => {
    if (chapters.length === 0) return
    useReaderNavigationStore.getState().setUnits(outlineUnits)
    useReaderNavigationStore
      .getState()
      .syncMobi(chapters, currentChapterId, currentTocFlatIndex)
  }, [chapters, currentChapterId, currentTocFlatIndex, outlineUnits])

  const loadChapterById = useCallback(async (chapterId: string): Promise<boolean> => {
    const mobi = mobiRef.current
    if (!mobi) return false

    const chapter = mobi.loadChapter(chapterId)
    if (!chapter) return false

    const bodyHtml = normalizeMobiChapterHtml(chapter.html)
    if (!isMobiChapterReadable(bodyHtml || chapter.html)) return false

    const documentHtml = await buildMobiChapterDocument(
      { ...chapter, html: bodyHtml || chapter.html },
      themeRef.current,
    )
    if (!/<body[^>]*>[\s\S]*\S[\s\S]*<\/body>/i.test(documentHtml)) {
      return false
    }

    setCurrentChapterId(chapterId)
    currentChapterIdRef.current = chapterId
    useReadingProgressStore.getState().saveMobiProgress(filePath, { chapterId })
    setChapterDocHtml(documentHtml)
    setLoadError(null)
    return true
  }, [filePath])

  const loadChapterAtIndex = useCallback(
    async (flatIndex: number, options?: { forceReload?: boolean }) => {
      const item = chaptersRef.current[flatIndex]
      if (!item) return false

      setCurrentTocFlatIndex(flatIndex)

      if (!options?.forceReload && item.id === currentChapterIdRef.current) {
        return true
      }

      setChapterLoading(true)
      try {
        const loaded = await loadChapterById(item.id)
        if (!loaded) {
          toast.error('该章节暂无正文')
        }
        return loaded
      } finally {
        setChapterLoading(false)
      }
    },
    [loadChapterById],
  )

  const loadChapter = useCallback(
    async (chapterId: string) => {
      const flatIndex = findLastFlatIndexById(chaptersRef.current, chapterId)
      if (flatIndex >= 0) {
        await loadChapterAtIndex(flatIndex, { forceReload: true })
        return
      }

      setChapterLoading(true)
      try {
        const loaded = await loadChapterById(chapterId)
        if (!loaded) {
          toast.error('该章节暂无正文')
        }
      } finally {
        setChapterLoading(false)
      }
    },
    [loadChapterAtIndex, loadChapterById],
  )

  const loadAdjacentChapter = useCallback(
    async (direction: 'next' | 'prev') => {
      const targetIndex =
        direction === 'next' ? nav.nextIndex : nav.previousIndex
      if (targetIndex < 0) {
        toast.error(direction === 'next' ? '已是最后一节' : '已是第一节')
        return
      }
      await loadChapterAtIndex(targetIndex)
    },
    [nav.nextIndex, nav.previousIndex, loadChapterAtIndex],
  )

  const syncMobiMarkOverlays = useCallback(
    (doc: Document, chapterId: string) => {
      if (!doc.body) return
      injectMobiMarkStyles(doc, themeRef.current)
      renderMobiMarkOverlays(doc.body, marksRef.current, chapterId)
    },
    [],
  )

  const bindChapterFrame = useCallback(
    (iframe: HTMLIFrameElement) => {
      chapterCleanupRef.current?.()

      const doc = iframe.contentDocument
      const win = iframe.contentWindow
      if (!doc || !win || !doc.body || !currentChapterId) return

      syncMobiMarkOverlays(doc, currentChapterId)

      const frameRect = iframe.getBoundingClientRect()

      const onMouseUp = () => {
        window.setTimeout(() => {
          if (!currentChapterId) return
          const snapshot = readMobiSelection(doc, win)
          if (!snapshot) {
            clearTextSelection()
            return
          }

          setSelectionSnapshot(snapshot)
          setSelectionToolbarPos({
            x: frameRect.left + snapshot.toolbarX,
            y: frameRect.top + snapshot.toolbarY,
          })
        }, 10)
      }

      const onSelectionChange = bindDocumentSelectionCollapse(doc, win, () => {
        setSelectionSnapshot(null)
        setSelectionToolbarPos(null)
      })

      const onClick = (event: MouseEvent) => {
        const target = event.target
        if (!(target instanceof Element)) return
        const anchor = target.closest('a')
        if (!anchor) return

        const href = anchor.getAttribute('href')
        if (!href || !/^(filepos:|kindle:)/i.test(href)) return

        event.preventDefault()
        const resolved = mobiRef.current?.resolveHref(href)
        if (resolved) {
          void loadChapter(resolved.id)
        }
      }

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

      const scrollRoot = doc.documentElement
      const onWheel = (event: WheelEvent) => {
        const turn = resolveWheelPageTurn(event.deltaY, {
          scrollTop: scrollRoot.scrollTop,
          scrollHeight: scrollRoot.scrollHeight,
          clientHeight: scrollRoot.clientHeight,
        })
        if (!turn) return

        event.preventDefault()
        if (wheelCooldownRef.current) return
        wheelCooldownRef.current = true
        window.setTimeout(() => {
          wheelCooldownRef.current = false
        }, 320)

        const navOptions = {
          isTocLike: isTocLikeMobiChapter,
          getLoadTargetKey: (chapter: MobiChapterItem) => chapter.id,
        }
        const activeFlatIndex =
          currentTocFlatIndex >= 0
            ? currentTocFlatIndex
            : findLastFlatIndexById(chapters, currentChapterId)
        const distinctTarget =
          turn === 'next'
            ? findNextDistinctLoadTarget(chapters, activeFlatIndex, navOptions)
            : findPreviousDistinctLoadTarget(chapters, activeFlatIndex, navOptions)

        if (distinctTarget) {
          void loadChapterAtIndex(distinctTarget.index, { forceReload: true })
        }
      }

      doc.addEventListener('mouseup', onMouseUp)
      doc.addEventListener('click', onClick)
      doc.addEventListener('mousemove', onMouseMove, { passive: true })
      scrollRoot.addEventListener('wheel', onWheel, { passive: false })

      chapterCleanupRef.current = () => {
        doc.removeEventListener('mouseup', onMouseUp)
        onSelectionChange()
        doc.removeEventListener('click', onClick)
        doc.removeEventListener('mousemove', onMouseMove)
        scrollRoot.removeEventListener('wheel', onWheel)
        if (hoverRaf !== 0) {
          window.cancelAnimationFrame(hoverRaf)
        }
      }
    },
    [chapters, clearTextSelection, currentChapterId, currentTocFlatIndex, loadChapterAtIndex, syncMobiMarkOverlays],
  )

  useEffect(() => {
    return bindOutsideReaderPointerDismiss((target) => {
      const iframe = iframeRef.current
      if (!iframe) return false
      return target === iframe || iframe.contains(target)
    }, clearTextSelection)
  }, [clearTextSelection])

  useEffect(() => {
    if (error && typeof error === 'object' && error !== null && 'code' in error) {
      reportAppError(error as AppError)
    }
  }, [error])

  useEffect(() => {
    if (!data) return

    let cancelled = false
    setReady(false)
    setChapters([])
    setChapterDocHtml('')
    setCurrentChapterId(undefined)
    setCurrentTocFlatIndex(-1)
    setLoadError(null)
    mobiRef.current?.destroy()
    mobiRef.current = null

    void (async () => {
      try {
        const mobi = await initKindleFile(data.data, filePath)
        if (cancelled) {
          mobi.destroy()
          return
        }

        mobiRef.current = mobi
        const spine = mobi.getSpine()
        const toc = mobi.getToc()
        const nextChapters = buildMobiChapterList(
          spine,
          toc,
          (id) => mobi.loadChapter(id)?.html,
          (href) => mobi.resolveHref(href)?.id,
        )
        setChapters(nextChapters)

        const savedChapterId = useReadingProgressStore.getState().getMobiProgress(filePath)?.chapterId
        const candidates = pickReadableMobiChapterCandidates(
          nextChapters,
          spine,
          savedChapterId,
        )
        setChapterLoading(true)
        try {
          let loaded = false
          for (const candidate of candidates) {
            const candidateIndex = nextChapters.findIndex(
              (item) => item.id === candidate.id && item.label === candidate.label,
            )
            if (candidateIndex >= 0) {
              loaded = await loadChapterAtIndex(candidateIndex, { forceReload: true })
            } else {
              loaded = await loadChapterById(candidate.id)
            }
            if (loaded) break
          }
          if (!loaded) {
            setLoadError('未能加载任何可读章节。若文件为旧版 MOBI，可尝试同书的 AZW3 格式。')
          }
        } finally {
          setChapterLoading(false)
        }

        if (!cancelled) {
          setReady(true)
          useReaderNavigationStore.getState().setReady(true)
        }
      } catch (cause) {
        if (!cancelled) {
          reportAppError({
            code: 'FILE_READ_ERROR',
            message: cause instanceof Error ? cause.message : 'MOBI 加载失败',
          })
        }
      }
    })()

    return () => {
      cancelled = true
      const chapterId = currentChapterIdRef.current
      if (chapterId) {
        useReadingProgressStore.getState().saveMobiProgress(filePath, { chapterId })
      }
      chapterCleanupRef.current?.()
      chapterCleanupRef.current = null
      mobiRef.current?.destroy()
      mobiRef.current = null
    }
  }, [data, filePath, loadChapterAtIndex, loadChapterById])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    if (!chapterDocHtml) {
      iframe.srcdoc = ''
      chapterCleanupRef.current?.()
      chapterCleanupRef.current = null
      return
    }

    const onLoad = () => {
      const doc = iframe.contentDocument
      if (!doc?.body) return
      bindChapterFrame(iframe)
      doc.documentElement.scrollTo({ top: 0 })
    }

    iframe.addEventListener('load', onLoad)
    iframe.srcdoc = chapterDocHtml

    return () => {
      iframe.removeEventListener('load', onLoad)
      chapterCleanupRef.current?.()
      chapterCleanupRef.current = null
    }
  }, [bindChapterFrame, chapterDocHtml])

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc?.body || !currentChapterId) return
    syncMobiMarkOverlays(doc, currentChapterId)
  }, [chapterDocHtml, currentChapterId, marks, syncMobiMarkOverlays])

  const prevThemeRef = useRef(theme)
  useEffect(() => {
    if (prevThemeRef.current === theme) return
    prevThemeRef.current = theme
    if (!currentChapterId || !ready) return
    setChapterLoading(true)
    void (async () => {
      try {
        await loadChapterById(currentChapterId)
      } finally {
        setChapterLoading(false)
      }
    })()
  }, [theme, currentChapterId, ready, loadChapterById])

  const addChapterBookmark = useCallback(async () => {
    if (!fileFingerprint || !currentChapterId) return
    const result = await createMark({
      filePath,
      fileFingerprint,
      kind: 'bookmark',
      anchor: { format: 'mobi', chapterId: currentChapterId },
      label: nav.current?.label ?? '书签',
    })
    if (isOk(result)) toast.success('已添加书签')
  }, [nav.current?.label, createMark, currentChapterId, fileFingerprint, filePath])

  const handleSaveAnnotation = useCallback(
    async (note: string) => {
      if (!selectionSnapshot || !fileFingerprint || !currentChapterId) return

      const result = await createMark({
        filePath,
        fileFingerprint,
        kind: note ? 'note' : 'highlight',
        anchor: {
          format: 'mobi',
          chapterId: currentChapterId,
          selectedText: selectionSnapshot.text,
          rects: selectionSnapshot.rects,
        },
        excerpt: selectionSnapshot.text,
        note: note || undefined,
      })

      if (isOk(result)) {
        marksRef.current = [...marksRef.current, result.value]
        toast.success(note ? '已保存批注' : '已添加高亮')
        const doc = iframeRef.current?.contentDocument
        if (doc?.body) {
          syncMobiMarkOverlays(doc, currentChapterId)
        }
      }

      clearTextSelection()
    },
    [clearTextSelection, createMark, currentChapterId, fileFingerprint, filePath, selectionSnapshot, syncMobiMarkOverlays],
  )

  const handleSelectMark = useCallback(
    (mark: ReadingMark) => {
      if (mark.anchor.format === 'mobi') {
        void loadChapter(mark.anchor.chapterId)
      }
    },
    [loadChapter],
  )

  const handleDeleteMark = useCallback(
    async (mark: ReadingMark) => {
      await deleteMark(mark.id)
      toast.success('已删除')
    },
    [deleteMark],
  )

  const goPrevChapter = useCallback(() => {
    if (nav.previous) void loadAdjacentChapter('prev')
  }, [nav.previous, loadAdjacentChapter])

  const goNextChapter = useCallback(() => {
    if (nav.next) void loadAdjacentChapter('next')
  }, [nav.next, loadAdjacentChapter])

  const { currentUnitId } = useReaderNavTitles()

  const readerHost = (
    <PaneErrorBoundary name="MOBI 阅读" filePath={filePath}>
      <div
        className={cn('mobi-viewer-host relative h-full min-h-0 overflow-hidden')}
        data-theme={theme}
      >
        {(isLoading || chapterLoading) && !chapterDocHtml ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            正在加载 MOBI…
          </div>
        ) : null}
        {ready && !chapterDocHtml && loadError ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {loadError}
          </div>
        ) : null}
        <iframe
          ref={iframeRef}
          title="MOBI 章节"
          className={cn('h-full w-full', !chapterDocHtml && 'hidden')}
        />
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
        onAddBookmark={() => void addChapterBookmark()}
        trailing={
          isLoading || !ready ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : null
        }
      />

      <ReaderContentShell
        marksOpen={marksOpen}
        marks={marks}
        onSelectMark={handleSelectMark}
        onDeleteMark={(mark) => void handleDeleteMark(mark)}
        onCloseMarks={closeMarks}
        tocOpen={tocOpen}
        units={outlineUnits}
        currentUnitId={currentUnitId}
        onCloseToc={closeToc}
        onSelectUnit={(unit) => {
          const index = decodeMobiTocHref(unit.href)
          if (index !== null) {
            void loadChapterAtIndex(index, { forceReload: true })
          }
        }}
      >
        {readerHost}
      </ReaderContentShell>

      <ReaderFooterNav ready={ready} onPrevious={goPrevChapter} onNext={goNextChapter} />

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
