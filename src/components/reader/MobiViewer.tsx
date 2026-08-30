import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { initKindleFile, type KindleBook } from '@/lib/reader/kindle-init'
import { Loader2 } from 'lucide-react'
import { PaneErrorBoundary } from '@/components/shared/PaneErrorBoundary'
import { AnnotationNoteDialog } from '@/components/reader/AnnotationNoteDialog'
import { EpubMarkTooltip } from '@/components/reader/EpubMarkTooltip'
import { ReaderContentShell } from '@/components/reader/ReaderContentShell'
import { ReaderFooterNav } from '@/components/reader/ReaderFooterNav'
import { ReaderToolbarShell } from '@/components/reader/ReaderToolbarShell'
import { ReadingMarkPopover } from '@/components/reader/ReadingMarkPopover'
import { SelectionToolbar } from '@/components/reader/SelectionToolbar'
import { useReaderBinary } from '@/hooks/reader/useReaderBinary'
import { useReadingMarkInspector } from '@/hooks/reader/useReadingMarkInspector'
import { extractDocumentText, extractViewportText, htmlToText } from '@/lib/agent/context/extract-dom-text'
import { registerReaderContent } from '@/lib/agent/context/reader-content-registry'
import { registerReaderMarks } from '@/lib/agent/context/reader-marks-registry'
import { registerSelectionProvider, commitReaderSelection, clearReaderSelection, readSelectionText } from '@/lib/agent/context/reader-selection-registry'
import { focusAgentComposerOnReaderSelection, openAgentComposerToAskSelection, addSelectionMarkerToComposer } from '@/lib/agent/context/focus-agent-composer'
import { DEFAULT_HIGHLIGHT_COLOR } from '@/lib/reader/reading-mark-colors'
import { findMarkForSelection, isClickNotDrag } from '@/lib/reader/reading-mark-hit'
import { useReaderSidePanels } from '@/hooks/reader/useReaderSidePanels'
import { useReadingMarks } from '@/hooks/reader/useReadingMarks'
import type { ReaderUnit } from '@/lib/reader/reader-navigation'
import { resolveWheelPageTurn } from '@/lib/reader/reader-wheel-navigation'
import {
  buildMobiChapterDocument,
  isMobiChapterReadable,
  normalizeMobiChapterHtml,
} from '@/lib/reader/mobi-chapter-html'
import { injectMobiMarkStyles } from '@/lib/reader/reader-mark-geometry'
import { findMobiMarksAtPoint, findMobiNoteMarkAtPoint, renderMobiMarkOverlays } from '@/lib/reader/mobi-reading-marks'
import {
  buildMobiChapterList,
  decodeMobiTocHref,
  encodeMobiTocHref,
  isTocLikeMobiChapter,
  pickReadableMobiChapterCandidates,
  type MobiChapterItem,
} from '@/lib/reader/mobi-navigation'
import {
  findFirstFlatIndexById,
} from '@/lib/reader/reader-chapter-nav'
import { scrollMobiChapterToFlatIndex } from '@/lib/reader/epub-scroll-toc'
import { readMobiSelection } from '@/lib/reader/mobi-selection'
import {
  bindDocumentSelectionCollapse,
  bindOutsideReaderPointerDismiss,
  clearWindowSelection,
} from '@/lib/reader/reader-selection-dismiss'
import {
  copyTextToClipboard,
  type PdfSelectionSnapshot,
} from '@/lib/reader/pdf-selection'
import { buildReadingFileFingerprint } from '@/lib/reader/reading-file-fingerprint'
import {
  resolveMobiChapter,
  tocFromMobiUnits,
  type ReadingNotesContentKind,
  type ReadingNotesScope,
} from '@/lib/reader/export-reading-notes'
import { saveReadingNotesExport } from '@/lib/reader/save-reading-notes-export'
import { reportAppError } from '@/lib/workspace/report-error'
import { useReadingProgressStore } from '@/stores/reading-progress-store'
import { useReaderNavigationStore, useReaderNavTitles, isNavIntentLocked } from '@/stores/reader-navigation-store'
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
  const [editingNoteMark, setEditingNoteMark] = useState<ReadingMark | null>(null)
  const pointerOriginRef = useRef<{ x: number; y: number } | null>(null)
  const [hoveredMark, setHoveredMark] = useState<ReadingMark | null>(null)
  const [markTooltipPos, setMarkTooltipPos] = useState<{ x: number; y: number } | null>(null)

  const { data, isLoading, error } = useReaderBinary(filePath)
  const { marks, createMark, updateMark, deleteMark } = useReadingMarks(filePath)
  const inspector = useReadingMarkInspector(marks)
  const inspectorRef = useRef(inspector)
  inspectorRef.current = inspector
  marksRef.current = marks

  const clearTextSelection = useCallback(() => {
    setSelectionSnapshot(null)
    setSelectionToolbarPos(null)
    clearReaderSelection()
    clearWindowSelection(iframeRef.current?.contentWindow ?? null)
  }, [])

  const dimTextSelection = useCallback(() => {
    setSelectionToolbarPos(null)
    clearWindowSelection(iframeRef.current?.contentWindow ?? null)
    inspectorRef.current.close()
  }, [])

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
    useReaderNavigationStore.getState().setUnits(chapters)
  }, [chapters])

  const applyNavFlatIndex = useCallback((flatIndex: number) => {
    const units = chaptersRef.current
    const item = units[flatIndex]
    if (!item) return

    // 直接走 MOBI 分派，避免 HMR/会话切换瞬间的 store.format 将 id 型条目
    // 误送入 EPUB 的 href 解析链路。
    useReaderNavigationStore.getState().syncMobi(units, item.id, flatIndex)
  }, [])

  const syncMobiViewportNav = useCallback((doc: Document, chapterId: string) => {
    if (chaptersRef.current.length === 0) return
    useReaderNavigationStore.getState().syncMobiViewport(chaptersRef.current, doc, chapterId)
  }, [])

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

      const navigationStore = useReaderNavigationStore.getState()
      const previousFlatIndex = navigationStore.nav.flatIndex
      applyNavFlatIndex(flatIndex)

      const sameSpine = item.id === currentChapterIdRef.current
      if (sameSpine && !options?.forceReload) {
        const doc = iframeRef.current?.contentDocument
        if (doc?.body) {
          const scrolled = scrollMobiChapterToFlatIndex(
            doc,
            chaptersRef.current,
            flatIndex,
            { behavior: 'auto' },
          )
          if (scrolled) return true

          navigationStore.syncMobi(
            chaptersRef.current,
            currentChapterIdRef.current,
            previousFlatIndex >= 0 ? previousFlatIndex : undefined,
          )
          navigationStore.clearNavIntent()
          toast.error('未找到该小节在正文中的位置')
          return false
        }
      }

      setChapterLoading(true)
      try {
        const loaded = await loadChapterById(item.id)
        if (!loaded) {
          toast.error('该章节暂无正文')
          return false
        }
        return true
      } finally {
        setChapterLoading(false)
      }
    },
    [applyNavFlatIndex, loadChapterById],
  )

  const loadChapter = useCallback(
    async (chapterId: string) => {
      const flatIndex = findFirstFlatIndexById(chaptersRef.current, chapterId)
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
      renderMobiMarkOverlays(doc.body, marksRef.current, chapterId, themeRef.current)
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

      const onMouseDown = (event: MouseEvent) => {
        pointerOriginRef.current = { x: event.clientX, y: event.clientY }
      }

      const onMouseUp = (event: MouseEvent) => {
        window.setTimeout(() => {
          if (!currentChapterId) return

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
          commitReaderSelection(filePath, snapshot.text)
          focusAgentComposerOnReaderSelection()
          setSelectionToolbarPos({
            x: frameRect.left + snapshot.toolbarX,
            y: frameRect.top + snapshot.toolbarY,
          })
        }, 10)
      }

      const onSelectionChange = bindDocumentSelectionCollapse(doc, win, () => {
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
      const onScroll = () => {
        if (isNavIntentLocked(useReaderNavigationStore.getState().navIntent)) return
        if (currentChapterId) {
          syncMobiViewportNav(doc, currentChapterId)
        }
      }

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

        const navState = useReaderNavigationStore.getState().nav
        const targetIndex = turn === 'next' ? navState.nextIndex : navState.previousIndex
        if (targetIndex >= 0) {
          void loadChapterAtIndex(targetIndex)
        }
      }

      doc.addEventListener('mousedown', onMouseDown)
      doc.addEventListener('mouseup', onMouseUp)
      doc.addEventListener('click', onClick)
      doc.addEventListener('mousemove', onMouseMove, { passive: true })
      scrollRoot.addEventListener('scroll', onScroll, { passive: true })
      scrollRoot.addEventListener('wheel', onWheel, { passive: false })
      requestAnimationFrame(() => onScroll())

      chapterCleanupRef.current = () => {
        doc.removeEventListener('mousedown', onMouseDown)
        doc.removeEventListener('mouseup', onMouseUp)
        onSelectionChange()
        doc.removeEventListener('click', onClick)
        doc.removeEventListener('mousemove', onMouseMove)
        scrollRoot.removeEventListener('scroll', onScroll)
        scrollRoot.removeEventListener('wheel', onWheel)
        if (hoverRaf !== 0) {
          window.cancelAnimationFrame(hoverRaf)
        }
      }
    },
    [chapters, clearTextSelection, currentChapterId, loadChapterAtIndex, syncMobiMarkOverlays, syncMobiViewportNav],
  )

  useEffect(() => {
    return bindOutsideReaderPointerDismiss((target) => {
      const iframe = iframeRef.current
      if (!iframe) return false
      return target === iframe || iframe.contains(target)
    }, dimTextSelection)
  }, [dimTextSelection])

  useEffect(() => {
    return () => {
      clearReaderSelection()
    }
  }, [filePath])

  useEffect(() => {
    if (error && typeof error === 'object' && error !== null && 'code' in error) {
      reportAppError(error as AppError)
    }
  }, [error])

  useEffect(() => {
    if (!data) return

    let cancelled = false
    chaptersRef.current = []
    currentChapterIdRef.current = undefined
    setReady(false)
    setChapters([])
    setChapterDocHtml('')
    setCurrentChapterId(undefined)
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
          (href) => {
            const resolved = mobi.resolveHref(href)
            if (!resolved?.id) return undefined
            return {
              id: resolved.id,
              selector: resolved.selector?.trim() || undefined,
            }
          },
        )
        chaptersRef.current = nextChapters
        setChapters(nextChapters)
        useReaderNavigationStore.getState().setUnits(nextChapters)

        const savedChapterId = useReadingProgressStore.getState().getMobiProgress(filePath)?.chapterId
        const candidates = pickReadableMobiChapterCandidates(
          nextChapters,
          savedChapterId,
        )
        setChapterLoading(true)
        try {
          let loaded = false
          for (const candidate of candidates) {
            const candidateIndex = nextChapters.findIndex(
              (item) => item.id === candidate.id && item.label === candidate.label,
            )
            if (candidateIndex < 0) continue

            // 初始化不能调用依赖 React state/ref 的 loadChapterAtIndex；此处直接使用
            // 本轮解析出的 nextChapters，避免首次打开时读取到空的 chaptersRef。
            useReaderNavigationStore
              .getState()
              .syncMobi(nextChapters, candidate.id, candidateIndex)
            loaded = await loadChapterById(candidate.id)
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
      const navFlatIndex = useReaderNavigationStore.getState().nav.flatIndex
      const chapterId = currentChapterIdRef.current
      const firstIndex =
        chapterId && chaptersRef.current.length > 0
          ? findFirstFlatIndexById(chaptersRef.current, chapterId)
          : -1

      if (chapterId && navFlatIndex >= 0 && navFlatIndex !== firstIndex) {
        const scrolled = scrollMobiChapterToFlatIndex(
          doc,
          chaptersRef.current,
          navFlatIndex,
          { behavior: 'auto' },
        )
        if (!scrolled) {
          const navigationStore = useReaderNavigationStore.getState()
          navigationStore.syncMobi(
            chaptersRef.current,
            chapterId,
            firstIndex >= 0 ? firstIndex : undefined,
          )
          navigationStore.clearNavIntent()
          toast.error('未找到该小节在正文中的位置')
        }
      } else {
        doc.documentElement.scrollTo({ top: 0 })
      }
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

  useEffect(() => {
    return registerReaderContent({
      filePath,
      getCurrentText: () => extractDocumentText(iframeRef.current?.contentDocument),
      getViewportText: () => extractViewportText(iframeRef.current?.contentDocument),
      iterateUnits: async function* () {
        const mobi = mobiRef.current
        if (!mobi) return
        for (const item of mobi.getSpine()) {
          const html = mobi.loadChapter(item.id)?.html
          if (!html) continue
          yield {
            label: chaptersRef.current.find((c) => c.id === item.id)?.label ?? item.id,
            text: htmlToText(html),
          }
        }
      },
      getUnitByIndex: async (flatIndex) => {
        const mobi = mobiRef.current
        const chapter = chaptersRef.current[flatIndex]
        if (!mobi || !chapter) return null
        const html = mobi.loadChapter(chapter.id)?.html
        if (!html) return null
        const text = htmlToText(html)
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

  const selectionSnapshotRef = useRef(selectionSnapshot)
  selectionSnapshotRef.current = selectionSnapshot

  const addChapterBookmark = useCallback(async () => {
    if (!fileFingerprint || !currentChapterId) {
      throw new Error('无法获取当前章节')
    }
    const result = await createMark({
      filePath,
      fileFingerprint,
      kind: 'bookmark',
      anchor: { format: 'mobi', chapterId: currentChapterId },
      label: nav.current?.label ?? '书签',
    })
    if (!isOk(result)) {
      throw new Error(result.error.message || '创建书签失败')
    }
    toast.success('已添加书签')
    return result.value
  }, [nav.current?.label, createMark, currentChapterId, fileFingerprint, filePath])

  const handleSaveAnnotation = useCallback(
    async (note: string, color = DEFAULT_HIGHLIGHT_COLOR) => {
      const snapshot = selectionSnapshotRef.current
      if (!snapshot || !fileFingerprint || !currentChapterId) {
        throw new Error('当前没有可用选区，请先划选文本')
      }

      const existing = findMarkForSelection(marks, {
        format: 'mobi',
        text: snapshot.text,
        chapterId: currentChapterId,
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
        const existingDoc = iframeRef.current?.contentDocument
        if (existingDoc?.body) {
          syncMobiMarkOverlays(existingDoc, currentChapterId)
        }
        clearTextSelection()
        return result.value
      }

      const result = await createMark({
        filePath,
        fileFingerprint,
        kind: note ? 'note' : 'highlight',
        anchor: {
          format: 'mobi',
          chapterId: currentChapterId,
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
      if (doc?.body) {
        syncMobiMarkOverlays(doc, currentChapterId)
      }

      clearTextSelection()
      return result.value
    },
    [clearTextSelection, createMark, currentChapterId, fileFingerprint, filePath, marks, syncMobiMarkOverlays, updateMark],
  )

  useEffect(() => {
    return registerReaderMarks({
      filePath,
      createBookmark: () => addChapterBookmark(),
      createNoteFromSelection: (note) => handleSaveAnnotation(note),
    })
  }, [addChapterBookmark, filePath, handleSaveAnnotation])

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
    if (nav.previousIndex >= 0) void loadAdjacentChapter('prev')
  }, [nav.previousIndex, loadAdjacentChapter])

  const goNextChapter = useCallback(() => {
    if (nav.nextIndex >= 0) void loadAdjacentChapter('next')
  }, [nav.nextIndex, loadAdjacentChapter])

  const { currentUnitId } = useReaderNavTitles()

  const handleExportNotes = useCallback(
    (contentKind: ReadingNotesContentKind, scope: ReadingNotesScope) => {
      const toc = tocFromMobiUnits(chapters)
      const key = currentChapterId ?? ''
      const currentHits = toc.filter((entry) => entry.matchKey === key)
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
        resolveChapter: resolveMobiChapter,
      })
    },
    [chapters, currentChapterId, filePath, marks],
  )

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
        onExportNotes={handleExportNotes}
        marksToc={tocFromMobiUnits(chapters)}
        marksCurrentChapterKey={currentChapterId}
        marksResolveChapter={resolveMobiChapter}
        tocOpen={tocOpen}
        units={outlineUnits}
        currentUnitId={currentUnitId}
        onCloseToc={closeToc}
        onSelectUnit={(unit) => {
          const index = decodeMobiTocHref(unit.href)
          if (index !== null) {
            void loadChapterAtIndex(index)
          }
        }}
      >
        {readerHost}
      </ReaderContentShell>

      <ReaderFooterNav ready={ready} onPrevious={goPrevChapter} onNext={goNextChapter} />

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
