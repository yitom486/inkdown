import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { PaneErrorBoundary } from '@/components/shared/PaneErrorBoundary'
import { AnnotationNoteDialog } from '@/components/reader/AnnotationNoteDialog'
import { EpubMarkTooltip } from '@/components/reader/EpubMarkTooltip'
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
import { extractDocumentText, extractViewportText } from '@/lib/agent/context/extract-dom-text'
import { registerReaderContent } from '@/lib/agent/context/reader-content-registry'
import { registerReaderMarks } from '@/lib/agent/context/reader-marks-registry'
import { registerSelectionProvider, commitReaderSelection, clearReaderSelection } from '@/lib/agent/context/reader-selection-registry'
import { focusAgentComposerOnReaderSelection, openAgentComposerToAskSelection, addSelectionMarkerToComposer } from '@/lib/agent/context/focus-agent-composer'
import { DEFAULT_HIGHLIGHT_COLOR } from '@/lib/reader/reading-mark-colors'
import { findMarkForSelection, isClickNotDrag } from '@/lib/reader/reading-mark-hit'
import { useReadingProgressStore } from '@/stores/reading-progress-store'
import { useAppSettingsStore } from '@/stores/app-settings-store'
import { useReaderNavigationStore, useReaderNavTitles, isNavIntentLocked } from '@/stores/reader-navigation-store'
import { cn } from '@/lib/utils'
import type { AppError } from '@shared/core/errors'
import type { ReadingMark } from '@shared/types/reading-mark'
import { isOk } from '@shared/core/result'
import { toast } from 'sonner'
import { appApi } from '@/api/app-api'
import { openFoliateBook, type FoliateBookAdapter } from '@/lib/reader/foliate-book-adapter'
import { parse as parseFoliateCfi, toRange as foliateCfiToRange } from '@foliate/epubcfi.js'
import type { FoliateViewElement } from '@foliate/view.js'
import type { OverlayerDrawFn } from '@foliate/overlayer.js'
import {
  flattenEpubToc,
  pickInitialChapter,
  type EpubChapter,
} from '@/lib/reader/epub-navigation'
import { normalizeLoadKey } from '@/lib/reader/reader-viewport-nav'
import { getEpubThemeRules, applyEpubReadingLayout } from '@/lib/reader/epub-themes'
import {
  buildEpubSnapshotFromRange,
  copyTextToClipboard,
  readEpubSelection,
} from '@/lib/reader/epub-selection'
import { findTextRangeInRoot } from '@/lib/reader/excerpt-text-match'
import { waitForDom } from '@/lib/reader/wait-for-dom'
import type { CreateMarkAtParams } from '@/lib/agent/context/reader-marks-registry'
import {
  bindDocumentSelectionCollapse,
  bindOutsideReaderPointerDismiss,
} from '@/lib/reader/reader-selection-dismiss'
import { buildReadingFileFingerprint } from '@/lib/reader/reading-file-fingerprint'
import {
  findCurrentChapterRef,
  resolveEpubChapter,
  resolveMobiChapter,
  tocFromEpubUnits,
  type ReadingNotesContentKind,
  type ReadingNotesScope,
} from '@/lib/reader/export-reading-notes'
import { saveReadingNotesExport } from '@/lib/reader/save-reading-notes-export'
import { saveAnkiCardsExport } from '@/lib/reader/export-anki-cards'
import { reportAppError } from '@/lib/workspace/report-error'

declare global {
  interface Window {
    /** E2E 专用钩子（仅 E2E_FOLIATE_READER 门控开启时挂载） */
    __inkdownE2eReader?: {
      selectText: (excerpt: string) => Promise<boolean>
      clickMark: (markId: string) => Promise<boolean>
      listMarks: () => Array<{ id: string; excerpt?: string }>
    }
  }
}

interface FoliateReaderViewerProps {
  filePath: string
  documentKind: 'epub' | 'mobi'
  theme: 'dark' | 'light'
}

const READING_PROGRESS_SAVE_MS = 400
const FOLIATE_READER_STYLE_ID = 'foliate-reader-theme'

/** overlay 键：与 apply 侧一致（书签无可视层，不进 overlay） */
function overlayerKeyForMark(mark: ReadingMark): string | null {
  if (mark.kind === 'bookmark') return null
  const anchor = mark.anchor
  if (anchor.format === 'epub') return anchor.cfiRange ?? anchor.cfi ?? null
  if (anchor.format === 'mobi') return anchor.cfiRange ?? anchor.cfi ?? null
  return null
}

function findMarkByOverlayerKey(marks: ReadingMark[], key: string): ReadingMark | undefined {
  return marks.find((mark) => overlayerKeyForMark(mark) === key)
}

/** epub.js themes 规则（selector→props）转可注入 CSS 文本 */
function themeRulesToCss(rules: Record<string, Record<string, string>>): string {
  return Object.entries(rules)
    .map(([selector, props]) => {
      const body = Object.entries(props)
        .map(([prop, value]) => `${prop}:${value};`)
        .join('')
      return `${selector}{${body}}`
    })
    .join('\n')
}

export function FoliateReaderViewer({ filePath, documentKind, theme }: FoliateReaderViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<FoliateViewElement | null>(null)
  const adapterRef = useRef<FoliateBookAdapter | null>(null)
  const chaptersRef = useRef<EpubChapter[]>([])
  const chapterSectionsRef = useRef<Array<number | null>>([])
  const [chapters, setChapters] = useState<EpubChapter[]>([])
  const nav = useReaderNavigationStore((state) => state.nav)
  const { tocOpen, marksOpen, toggleToc, toggleMarks, closeToc, closeMarks } = useReaderSidePanels()
  const [ready, setReady] = useState(false)
  const [globalProgress, setGlobalProgress] = useState(0)
  const [selectionSnapshot, setSelectionSnapshot] = useState<{
    text: string
    cfiRange: string
    rect: DOMRect
  } | null>(null)
  const [selectionToolbarPos, setSelectionToolbarPos] = useState<{ x: number; y: number } | null>(
    null,
  )
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [editingNoteMark, setEditingNoteMark] = useState<ReadingMark | null>(null)
  const [hoveredMark, setHoveredMark] = useState<ReadingMark | null>(null)
  const [markTooltipPos, setMarkTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const hoveredMarkIdRef = useRef<string | null>(null)
  const pointerOriginRef = useRef<{ x: number; y: number } | null>(null)
  const selectionSnapshotRef = useRef<typeof selectionSnapshot>(null)
  selectionSnapshotRef.current = selectionSnapshot
  const lastLocationRef = useRef<{ cfi?: string; sectionIndex: number; fraction: number } | null>(
    null,
  )
  const readerFontSize = useAppSettingsStore((state) => state.readerFontSize)
  const readerLineHeight = useAppSettingsStore((state) => state.readerLineHeight)
  const typography = useMemo(
    () => ({ fontSize: readerFontSize, lineHeight: readerLineHeight }),
    [readerFontSize, readerLineHeight],
  )
  const themeRef = useRef(theme)
  themeRef.current = theme
  const typographyRef = useRef(typography)
  typographyRef.current = typography
  const filePathRef = useRef(filePath)
  filePathRef.current = filePath
  const kindRef = useRef(documentKind)
  kindRef.current = documentKind

  const { data, isLoading, error } = useReaderBinary(filePath)
  const { marks, createMark, updateMark, deleteMark } = useReadingMarks(filePath)
  const inspector = useReadingMarkInspector(marks)
  const inspectorRef = useRef(inspector)
  inspectorRef.current = inspector
  const marksRef = useRef<ReadingMark[]>([])
  marksRef.current = marks
  const saveProgressTimerRef = useRef<number | null>(null)
  const fileFingerprint = data
    ? buildReadingFileFingerprint(filePath, data.data.byteLength)
    : ''

  const isEpub = documentKind === 'epub'

  useEffect(() => {
    useReaderNavigationStore.getState().beginSession(filePath, documentKind as 'epub' | 'mobi')
    return () => {
      useReaderNavigationStore.getState().beginSession('', documentKind as 'epub' | 'mobi')
    }
  }, [filePath, documentKind])

  const clearTextSelection = useCallback(() => {
    setSelectionSnapshot(null)
    setSelectionToolbarPos(null)
    clearReaderSelection()
    try {
      viewRef.current?.renderer?.getContents().forEach((item) => {
        item.doc.defaultView?.getSelection()?.removeAllRanges()
      })
    } catch {
      // 视图已销毁时忽略
    }
  }, [])

  /** 收起高亮、工具栏与标记浮层，保留 sticky 供 Agent 读取 */
  const dimTextSelection = useCallback(() => {
    if (noteDialogOpen) return
    setSelectionToolbarPos(null)
    inspectorRef.current.close()
  }, [noteDialogOpen])

  const resolveGlobalProgress = useCallback((fraction: number): number => {
    return Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0
  }, [])

  const persistReadingProgress = useCallback(
    (sectionIndex: number, fraction: number, cfi?: string) => {
      const percentage = resolveGlobalProgress(fraction)
      setGlobalProgress(percentage)
      const sectionId = adapterRef.current?.sections[sectionIndex]?.id
      if (kindRef.current === 'epub') {
        if (!cfi) return
        useReadingProgressStore.getState().saveEpubProgress(filePathRef.current, {
          cfi,
          href: sectionId,
          percentage,
        })
        return
      }
      if (sectionId) {
        useReadingProgressStore.getState().saveMobiProgress(filePathRef.current, {
          chapterId: sectionId,
        })
      }
    },
    [resolveGlobalProgress],
  )

  const schedulePersistReadingProgress = useCallback(
    (sectionIndex: number, fraction: number, cfi?: string) => {
      if (saveProgressTimerRef.current !== null) {
        window.clearTimeout(saveProgressTimerRef.current)
      }
      saveProgressTimerRef.current = window.setTimeout(() => {
        saveProgressTimerRef.current = null
        persistReadingProgress(sectionIndex, fraction, cfi)
      }, READING_PROGRESS_SAVE_MS)
    },
    [persistReadingProgress],
  )

  const syncChapterNav = useCallback((sectionIndex: number, cfi?: string) => {
    const units = chaptersRef.current
    if (units.length === 0) return
    if (isNavIntentLocked(useReaderNavigationStore.getState().navIntent)) return
    const href = adapterRef.current?.sections[sectionIndex]?.id
    const flatIndex = units.findIndex((unit) =>
      href ? normalizeLoadKey(unit.href) === normalizeLoadKey(href) : false,
    )
    if (flatIndex >= 0) {
      useReaderNavigationStore.getState().syncFlatIndex(flatIndex)
    } else {
      useReaderNavigationStore.getState().syncEpub(units, { href, cfi })
    }
    // E2E 可观测性：门控开启时把当前节纯文本挂到容器，供真机断言穿透 closed shadow DOM
    if (
      typeof window !== 'undefined' &&
      window.electronAPI?.e2eFoliateReader === true &&
      containerRef.current
    ) {
      const host = containerRef.current
      void adapterRef.current
        ?.loadSectionText(sectionIndex)
        .then((text) => {
          host.dataset.e2eSectionText = text.slice(0, 500)
        })
        .catch(() => undefined)
    }
  }, [])

  const goToChapter = useCallback((chapter: EpubChapter | null, flatIndex?: number) => {
    const view = viewRef.current
    if (!chapter || !view) return
    let sectionIndex: number | null = null
    if (typeof flatIndex === 'number' && flatIndex >= 0) {
      sectionIndex = chapterSectionsRef.current[flatIndex] ?? null
    }
    if (sectionIndex === null || sectionIndex < 0) {
      sectionIndex = adapterRef.current?.resolveHref(chapter.href) ?? null
    }
    if (sectionIndex === null || sectionIndex < 0) return
    useReaderNavigationStore.getState().syncFlatIndex(
      typeof flatIndex === 'number' && flatIndex >= 0
        ? flatIndex
        : chaptersRef.current.findIndex((item) => item.href === chapter.href),
    )
    void view.goTo(sectionIndex).catch(() => undefined)
  }, [])

  const applyDocTheme = useCallback((doc: Document) => {
    try {
      applyEpubReadingLayout(doc, themeRef.current, typographyRef.current)
      const css = themeRulesToCss(getEpubThemeRules(themeRef.current, typographyRef.current))
      let style = doc.getElementById(FOLIATE_READER_STYLE_ID) as HTMLStyleElement | null
      if (!style) {
        style = doc.createElement('style')
        style.id = FOLIATE_READER_STYLE_ID
        doc.head.appendChild(style)
      }
      style.textContent = css
    } catch {
      // 章节文档不可写时忽略
    }
  }, [])

  const syncVisualMarks = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    for (const mark of marksRef.current) {
      const key = overlayerKeyForMark(mark)
      if (!key) continue
      void view.addAnnotation({ value: key }).catch(() => undefined)
    }
  }, [])

  const handleSelectMark = useCallback((mark: ReadingMark) => {
    const view = viewRef.current
    if (!view) return
    const anchor = mark.anchor
    const cfi =
      anchor.format === 'epub' || anchor.format === 'mobi'
        ? (anchor.cfiRange ?? anchor.cfi)
        : undefined
    if (cfi) {
      void view.goTo(cfi).catch(() => undefined)
      return
    }
    if (anchor.format === 'mobi') {
      const index = adapterRef.current?.sections.findIndex((s) => s.id === anchor.chapterId) ?? -1
      if (index >= 0) void view.goTo(index).catch(() => undefined)
    }
  }, [])

  const handleDeleteMark = useCallback(
    async (mark: ReadingMark) => {
      const key = overlayerKeyForMark(mark)
      if (key) {
        try {
          await viewRef.current?.deleteAnnotation({ value: key })
        } catch {
          // overlay 缺失不影响删除本体
        }
      }
      await deleteMark(mark.id)
      toast.success('已删除')
    },
    [deleteMark],
  )

  const addBookmarkAtCurrent = useCallback(async () => {
    const current = lastLocationRef.current
    if (!current?.cfi || !fileFingerprint) {
      toast.error('无法获取当前阅读位置')
      throw new Error('无法获取当前阅读位置')
    }
    const sectionId = adapterRef.current?.sections[current.sectionIndex]?.id
    const result = await createMark({
      filePath,
      fileFingerprint,
      kind: 'bookmark',
      anchor:
        kindRef.current === 'epub'
          ? { format: 'epub', cfi: current.cfi, href: sectionId }
          : { format: 'mobi', chapterId: sectionId ?? '', cfi: current.cfi },
      label: nav.current?.label ?? '书签',
    })
    if (!isOk(result)) {
      throw new Error(result.error.message || '创建书签失败')
    }
    toast.success('已添加书签')
    return result.value
  }, [createMark, fileFingerprint, filePath, nav])

  const handleSaveAnnotation = useCallback(
    async (note: string, color = DEFAULT_HIGHLIGHT_COLOR) => {
      const snapshot = selectionSnapshotRef.current
      if (!snapshot || !fileFingerprint) {
        throw new Error('当前没有可用选区，请先划选文本')
      }
      const sectionIndex = lastLocationRef.current?.sectionIndex
      const sectionId =
        typeof sectionIndex === 'number'
          ? (adapterRef.current?.sections[sectionIndex]?.id ?? '')
          : ''
      const anchor =
        kindRef.current === 'epub'
          ? {
              format: 'epub' as const,
              cfi: snapshot.cfiRange,
              cfiRange: snapshot.cfiRange,
              href: sectionId,
              selectedText: snapshot.text,
            }
          : {
              format: 'mobi' as const,
              chapterId: sectionId,
              cfi: snapshot.cfiRange,
              cfiRange: snapshot.cfiRange,
              selectedText: snapshot.text,
            }

      const existing = findMarkForSelection(marks, {
        format: kindRef.current,
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
        syncVisualMarks()
        toast.success(trimmed ? '已保存批注' : '已更新高亮')
        clearTextSelection()
        return result.value
      }

      const result = await createMark({
        filePath,
        fileFingerprint,
        kind: note ? 'note' : 'highlight',
        anchor,
        excerpt: snapshot.text,
        note: note || undefined,
        color,
      })
      if (!isOk(result)) {
        throw new Error(result.error.message || '创建批注失败')
      }
      syncVisualMarks()
      toast.success(note ? '已保存批注' : '已添加高亮')
      clearTextSelection()
      return result.value
    },
    [clearTextSelection, createMark, fileFingerprint, filePath, marks, syncVisualMarks, updateMark],
  )

  const getRenderedDocs = useCallback((): Array<{ doc: Document; index: number }> => {
    try {
      const renderer = viewRef.current?.renderer as unknown as {
        getContents: () => Array<{ doc: Document; index: number }>
      } | null
      return renderer?.getContents() ?? []
    } catch {
      return []
    }
  }, [])

  const markHoverHandlers = useCallback(
    () => ({
      onEnter: (mark: ReadingMark, anchor: { left: number; top: number; width: number }) => {
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
    }),
    [],
  )

  /** 同一 range 的检查器开启逻辑（overlay 点击与测试钩子共用） */
  const openInspectorAtRange = useCallback((mark: ReadingMark, range: Range) => {
    const doc = range.startContainer.ownerDocument
    if (!doc) return false
    const frame = doc.defaultView?.frameElement as HTMLElement | null
    const frameRect = frame?.getBoundingClientRect()
    const rect = range.getBoundingClientRect()
    inspectorRef.current.openAt(
      [mark],
      (frameRect?.left ?? 0) + rect.left + rect.width / 2,
      (frameRect?.top ?? 0) + rect.top,
    )
    return true
  }, [])

  const handleCreateMarkAt = useCallback(
    async ({ excerpt, note, flatIndex }: CreateMarkAtParams) => {
      const navState = useReaderNavigationStore.getState().nav
      if (typeof flatIndex === 'number' && flatIndex >= 0 && flatIndex !== navState.flatIndex) {
        const chapter = chaptersRef.current[flatIndex]
        if (!chapter) throw new Error('章节索引无效')
        goToChapter(chapter, flatIndex)
      }
      const snapshot = await waitForDom(() => {
        for (const { doc, index } of getRenderedDocs()) {
          const body = doc.body
          if (!body) continue
          const range = findTextRangeInRoot(body, excerpt)
          if (!range) continue
          const text = range.toString().trim()
          if (!text) continue
          let cfiRange = ''
          try {
            cfiRange = viewRef.current?.getCFI(index, range) ?? ''
          } catch {
            cfiRange = ''
          }
          if (!cfiRange) continue
          const built = buildEpubSnapshotFromRange(
            {
              window: doc.defaultView as Window,
              cfiFromRange: (target) => viewRef.current?.getCFI(index, target) ?? '',
            },
            range,
            text,
          )
          if (built) return built
        }
        return null
      })
      if (!snapshot) {
        throw new Error('未在当前章节找到该摘录，请打开对应章节后重试')
      }
      selectionSnapshotRef.current = snapshot
      setSelectionSnapshot(snapshot)
      return handleSaveAnnotation(note)
    },
    [getRenderedDocs, goToChapter, handleSaveAnnotation],
  )

  const bindSectionDocInteractions = useCallback(
    (doc: Document, index: number) => {
      const cleanupFns: Array<() => void> = []
      const onMouseDown = (event: MouseEvent) => {
        pointerOriginRef.current = { x: event.clientX, y: event.clientY }
      }
      const handleDocPointerUp = (isClick: boolean): void => {
        const frame = doc.defaultView?.frameElement as HTMLElement | null
        const frameRect = frame?.getBoundingClientRect()
        const view = viewRef.current
        if (!view) return
        const contents = {
          window: doc.defaultView as Window,
          cfiFromRange: (range: Range) => view.getCFI(index, range),
        }
        const snapshot = readEpubSelection(contents)
        if (!snapshot) {
          if (isClick) {
            inspectorRef.current.close()
          }
          return
        }
        inspectorRef.current.close()
        setSelectionSnapshot(snapshot)
        selectionSnapshotRef.current = snapshot
        commitReaderSelection(filePathRef.current, snapshot.text)
        focusAgentComposerOnReaderSelection()
        setSelectionToolbarPos({
          x: (frameRect?.left ?? 0) + snapshot.rect.left + snapshot.rect.width / 2,
          y: (frameRect?.top ?? 0) + snapshot.rect.top,
        })
        void origin
      }
      const onMouseUp = (event: MouseEvent) => {
        const origin = pointerOriginRef.current
        const isClick = isClickNotDrag(origin, {
          clientX: event.clientX,
          clientY: event.clientY,
        } as MouseEvent)
        window.setTimeout(() => {
          handleDocPointerUp(isClick)
        }, 10)
      }
      doc.addEventListener('mousedown', onMouseDown)
      doc.addEventListener('mouseup', onMouseUp)
      const unbindCollapse = bindDocumentSelectionCollapse(doc, doc.defaultView as Window, () => {
        setSelectionToolbarPos(null)
      })
      cleanupFns.push(() => {
        doc.removeEventListener('mousedown', onMouseDown)
        doc.removeEventListener('mouseup', onMouseUp)
        unbindCollapse()
      })

      // 批注 hover：经本节 overlayer 命中，仅有正文的批注才浮层
      let hoverRaf = 0
      const onMouseMove = (event: MouseEvent) => {
        if (hoverRaf !== 0) return
        hoverRaf = window.requestAnimationFrame(() => {
          hoverRaf = 0
          const overlayer = viewRef.current?.renderer
            ?.getContents()
            .find((item) => item.doc === doc)?.overlayer
          if (!overlayer) return
          const [key] = overlayer.hitTest({ x: event.clientX, y: event.clientY })
          const mark =
            typeof key === 'string' ? findMarkByOverlayerKey(marksRef.current, key) : undefined
          if (!mark?.note?.trim()) {
            if (hoveredMarkIdRef.current !== null) {
              hoveredMarkIdRef.current = null
              markHoverHandlers().onLeave()
            }
            return
          }
          if (hoveredMarkIdRef.current === mark.id) return
          hoveredMarkIdRef.current = mark.id
          const frame = doc.defaultView?.frameElement as HTMLElement | null
          const frameRect = frame?.getBoundingClientRect()
          // 以事件点为锚显示浮层（overlay 内坐标即 iframe 视口坐标）
          markHoverHandlers().onEnter(mark, {
            left: (frameRect?.left ?? 0) + event.clientX,
            top: (frameRect?.top ?? 0) + event.clientY,
            width: 0,
          })
        })
      }
      const onMouseLeave = () => {
        hoveredMarkIdRef.current = null
        markHoverHandlers().onLeave()
      }
      doc.addEventListener('mousemove', onMouseMove, { passive: true })
      doc.addEventListener('mouseleave', onMouseLeave)
      cleanupFns.push(() => {
        doc.removeEventListener('mousemove', onMouseMove)
        doc.removeEventListener('mouseleave', onMouseLeave)
        if (hoverRaf !== 0) {
          window.cancelAnimationFrame(hoverRaf)
          hoverRaf = 0
        }
      })
      return () => {
        cleanupFns.forEach((fn) => {
          try {
            fn()
          } catch {
            // 文档已销毁时忽略
          }
        })
      }
    },
    [markHoverHandlers],
  )

  useEffect(() => {
    return bindOutsideReaderPointerDismiss(
      (target) => {
        const container = containerRef.current
        if (!container) return false
        return container.contains(target)
      },
      () => {
        if (noteDialogOpen) return
        dimTextSelection()
      },
    )
  }, [dimTextSelection, noteDialogOpen])

  useEffect(() => {
    return () => {
      clearReaderSelection()
    }
  }, [filePath])

  useEffect(() => {
    if (!ready) return
    syncVisualMarks()
  }, [marks, ready, readerFontSize, readerLineHeight, syncVisualMarks, theme])

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
    setSelectionSnapshot(null)
    setSelectionToolbarPos(null)
    selectionSnapshotRef.current = null
    lastLocationRef.current = null
    chaptersRef.current = []
    chapterSectionsRef.current = []
    viewRef.current = null
    adapterRef.current = null

    let cancelled = false
    let view: FoliateViewElement | null = null
    const docCleanups = new Map<Document, () => void>()

    // view 级 relocate 明细：{ fraction（全书）, section: { current }, cfi, tocItem }，
    // 与 paginator 级 { index } 形状不同，此处只认 view 级。
    const onRelocate = (event: CustomEvent) => {
      const detail = event.detail as {
        section?: { current?: number }
        fraction?: number
        cfi?: string
      }
      if (cancelled) return
      const sectionIndex = detail.section?.current ?? 0
      const fraction = detail.fraction ?? 0
      lastLocationRef.current = {
        cfi: detail.cfi,
        sectionIndex,
        fraction,
      }
      setGlobalProgress(resolveGlobalProgress(fraction))
      syncChapterNav(sectionIndex, detail.cfi)
      schedulePersistReadingProgress(sectionIndex, fraction, detail.cfi)
    }

    const onLoad = (event: CustomEvent) => {
      const detail = event.detail as { doc: Document; index: number }
      if (cancelled) return
      applyDocTheme(detail.doc)
      docCleanups.get(detail.doc)?.()
      docCleanups.set(detail.doc, bindSectionDocInteractions(detail.doc, detail.index))
      syncVisualMarks()
    }

    const onLink = (event: CustomEvent) => {
      const detail = event.detail as { href?: string }
      if (!detail.href) return
      event.preventDefault()
      const sectionIndex = adapterRef.current?.resolveHref(detail.href) ?? null
      if (sectionIndex === null || sectionIndex < 0 || !viewRef.current) return
      const flatIndex = chaptersRef.current.findIndex(
        (_, flat) => chapterSectionsRef.current[flat] === sectionIndex,
      )
      if (flatIndex >= 0) {
        useReaderNavigationStore.getState().syncFlatIndex(flatIndex)
      }
      void viewRef.current.goTo(sectionIndex).catch(() => undefined)
    }

    const onExternalLink = (event: CustomEvent) => {
      const detail = event.detail as { href?: string; href_?: string }
      event.preventDefault()
      const href = detail.href ?? detail.href_
      if (href) void appApi.openExternal(href)
    }

    const onShowAnnotation = (event: CustomEvent) => {
      const detail = event.detail as { value: string; index: number; range: Range }
      if (cancelled) return
      const mark = findMarkByOverlayerKey(marksRef.current, detail.value)
      if (!mark) return
      openInspectorAtRange(mark, detail.range)
    }

    const onDrawAnnotation = (event: CustomEvent) => {
      const detail = event.detail as {
        draw: (drawFunc: unknown, drawOptions?: unknown) => void
        annotation: { value: string }
      }
      const mark = findMarkByOverlayerKey(marksRef.current, detail.annotation.value)
      const draw = async () => {
        const { Overlayer } = await import('@foliate/overlayer.js')
        detail.draw(Overlayer.highlight satisfies OverlayerDrawFn, {
          color: mark?.color ?? DEFAULT_HIGHLIGHT_COLOR,
        })
      }
      void draw().catch(() => undefined)
    }

    void (async () => {
      try {
        const bytes = new Uint8Array(
          data.data.buffer.slice(data.data.byteOffset, data.data.byteOffset + data.data.byteLength),
        )
        const adapter = await openFoliateBook(bytes, filePath)
        if (cancelled) return
        adapterRef.current = adapter

        const flatChapters: EpubChapter[] = []
        const sectionIndices: Array<number | null> = []
        const walk = (items: typeof adapter.toc, level: number) => {
          for (const item of items) {
            flatChapters.push({
              label: item.label.trim() || '未命名章节',
              href: item.href ?? `section:${item.sectionIndex ?? -1}`,
              level,
            })
            sectionIndices.push(item.sectionIndex)
            if (item.children.length > 0) walk(item.children, level + 1)
          }
        }
        walk(adapter.toc, 0)
        // 无目录的书：按 spine 兜底，保证底栏/导出可用
        if (flatChapters.length === 0) {
          adapter.sections.forEach((section, index) => {
            flatChapters.push({ label: `第 ${index + 1} 节`, href: section.id, level: 0 })
            sectionIndices.push(index)
          })
        }
        chaptersRef.current = flatChapters
        chapterSectionsRef.current = sectionIndices
        setChapters(flatChapters)
        useReaderNavigationStore.getState().setUnits(flatChapters)

        // view.js 模块副作用完成自定义元素注册，直接按标签实例化
        await import('@foliate/view.js')
        if (cancelled) return
        const element = document.createElement('foliate-view') as unknown as FoliateViewElement
        element.style.width = '100%'
        element.style.height = '100%'
        container.appendChild(element)
        view = element
        viewRef.current = element

        element.addEventListener('relocate', onRelocate as EventListener)
        element.addEventListener('load', onLoad as EventListener)
        element.addEventListener('link', onLink as EventListener)
        element.addEventListener('external-link', onExternalLink as EventListener)
        element.addEventListener('show-annotation', onShowAnnotation as EventListener)
        element.addEventListener('draw-annotation', onDrawAnnotation as EventListener)

        await element.open(adapter.engineBook)
        if (cancelled) return
        try {
          element.renderer?.setAttribute('flow', 'scrolled')
        } catch {
          // paginated 回退：保持默认分页
        }

        // 恢复进度：epub 用 CFI，mobi 用章节；都不命中则首个正文章节
        let restored = false
        if (kindRef.current === 'epub') {
          const saved = useReadingProgressStore.getState().getEpubProgress(filePath)
          if (saved?.percentage != null) setGlobalProgress(saved.percentage)
          if (saved?.cfi) {
            try {
              await element.goTo(saved.cfi)
              restored = true
            } catch {
              restored = false
            }
          }
        } else {
          const saved = useReadingProgressStore.getState().getMobiProgress(filePath)
          if (saved?.chapterId) {
            const index = adapter.sections.findIndex((s) => s.id === saved.chapterId)
            if (index >= 0) {
              try {
                await element.goTo(index)
                restored = true
              } catch {
                restored = false
              }
            }
          }
        }
        if (!restored) {
          const initial = pickInitialChapter(flatChapters)
          const initialFlat = initial
            ? flatChapters.findIndex(
                (item) => item.href === initial.href && item.label === initial.label,
              )
            : -1
          const initialSection =
            initialFlat >= 0 ? (sectionIndices[initialFlat] ?? null) : null
          if (initialSection !== null && initialSection >= 0) {
            try {
              await element.goTo(initialSection)
            } catch {
              // 回退首节由 init 兜底
            }
            if (initialFlat >= 0) {
              useReaderNavigationStore.getState().syncFlatIndex(initialFlat)
            }
          } else {
            await element.init({ showTextStart: true })
          }
        }

        if (!cancelled) {
          setReady(true)
          useReaderNavigationStore.getState().setReady(true)
        }
      } catch (cause) {
        if (!cancelled) {
          reportAppError({
            code: 'FILE_READ_ERROR',
            message: cause instanceof Error ? cause.message : '电子书加载失败',
          })
        }
      }
    })()

    return () => {
      cancelled = true
      if (saveProgressTimerRef.current !== null) {
        window.clearTimeout(saveProgressTimerRef.current)
        saveProgressTimerRef.current = null
      }
      try {
        const current = lastLocationRef.current
        if (current) {
          persistReadingProgress(current.sectionIndex, current.fraction, current.cfi)
        }
      } catch {
        // 视图已销毁时忽略
      }
      docCleanups.forEach((cleanup) => {
        try {
          cleanup()
        } catch {
          // 文档已销毁时忽略
        }
      })
      docCleanups.clear()
      try {
        if (view) {
          view.removeEventListener('relocate', onRelocate as EventListener)
          view.removeEventListener('load', onLoad as EventListener)
          view.removeEventListener('link', onLink as EventListener)
          view.removeEventListener('external-link', onExternalLink as EventListener)
          view.removeEventListener('show-annotation', onShowAnnotation as EventListener)
          view.removeEventListener('draw-annotation', onDrawAnnotation as EventListener)
          view.close()
          view.remove()
        }
      } catch {
        // 销毁期异常忽略
      }
      try {
        adapterRef.current?.destroy()
      } catch {
        // 忽略
      }
      viewRef.current = null
      adapterRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filePath])

  // 主题/排版变化只重刷已渲染章节文档，不重建 book
  useEffect(() => {
    if (!ready) return
    for (const { doc } of getRenderedDocs()) {
      applyDocTheme(doc)
    }
    syncVisualMarks()
  }, [applyDocTheme, getRenderedDocs, ready, readerFontSize, readerLineHeight, syncVisualMarks, theme])

  useEffect(() => {
    return registerReaderContent({
      filePath,
      getCurrentText: () => {
        return getRenderedDocs()
          .map((item) => extractDocumentText(item.doc))
          .join('\n\n')
      },
      getViewportText: () => {
        return getRenderedDocs()
          .map((item) => extractViewportText(item.doc))
          .join('\n\n')
      },
      iterateUnits: async function* () {
        const adapter = adapterRef.current
        if (!adapter) return
        for (const section of adapter.sections) {
          const text = await adapter.loadSectionText(section.index)
          const chapter = chaptersRef.current.find(
            (_, flat) => chapterSectionsRef.current[flat] === section.index,
          )
          if (text) yield { label: chapter?.label ?? `第 ${section.index + 1} 节`, text }
        }
      },
      getUnitByIndex: async (flatIndex) => {
        const adapter = adapterRef.current
        const chapter = chaptersRef.current[flatIndex]
        if (!adapter || !chapter) return null
        const sectionIndex = chapterSectionsRef.current[flatIndex]
        if (sectionIndex === null || sectionIndex === undefined || sectionIndex < 0) return null
        const text = await adapter.loadSectionText(sectionIndex)
        if (!text.trim()) return null
        return { label: chapter.label, text }
      },
    })
  }, [filePath, getRenderedDocs])

  useEffect(() => {
    return registerSelectionProvider({
      filePath,
      getSelectionText: () => selectionSnapshotRef.current?.text?.trim() || null,
    })
  }, [filePath])

  useEffect(() => {
    return registerReaderMarks({
      filePath,
      createBookmark: () => addBookmarkAtCurrent(),
      createNoteFromSelection: (note) => handleSaveAnnotation(note),
      createMarkAt: (params) => handleCreateMarkAt(params),
      navigateToFlatIndex: (index) => {
        const chapter = chaptersRef.current[index]
        if (chapter) goToChapter(chapter, index)
      },
    })
  }, [addBookmarkAtCurrent, filePath, goToChapter, handleCreateMarkAt, handleSaveAnnotation])

  // E2E 专用：closed shadow DOM 无法做 DOM 级选区/点击，钩子走同一管线
  //（findTextRangeInRoot → snapshot → toolbar；toRange → inspector）。
  useEffect(() => {
    if (typeof window === 'undefined' || window.electronAPI?.e2eFoliateReader !== true) return
    window.__inkdownE2eReader = {
      listMarks: () =>
        marksRef.current.map((mark) => ({ id: mark.id, excerpt: mark.excerpt })),
      selectText: async (excerpt: string) => {
        const view = viewRef.current
        if (!view) return false
        // 章节文档异步渲染，最长等 ~6s（与 handleCreateMarkAt 同策略）
        const found = await waitForDom(() => {
          for (const { doc, index } of getRenderedDocs()) {
            const body = doc.body
            if (!body) continue
            const range = findTextRangeInRoot(body, excerpt)
            if (range) return { doc, index, range }
          }
          return null
        }, { attempts: 120, delayMs: 50 })
        if (!found) return false
        const { doc, index, range } = found
        const selection = doc.defaultView?.getSelection()
        if (!selection) return false
        selection.removeAllRanges()
        try {
          selection.addRange(range.cloneRange())
        } catch {
          return false
        }
          const snapshot = buildEpubSnapshotFromRange(
            {
              window: doc.defaultView as Window,
              cfiFromRange: (target) => view.getCFI(index, target),
            },
            range,
            range.toString(),
          )
          if (!snapshot) return false
          inspectorRef.current.close()
          setSelectionSnapshot(snapshot)
          selectionSnapshotRef.current = snapshot
          commitReaderSelection(filePathRef.current, snapshot.text)
          const frame = doc.defaultView?.frameElement as HTMLElement | null
          const frameRect = frame?.getBoundingClientRect()
          const rect = range.getBoundingClientRect()
          setSelectionToolbarPos({
            x: (frameRect?.left ?? 0) + rect.left + rect.width / 2,
            y: (frameRect?.top ?? 0) + rect.top,
          })
          return true
        },
      clickMark: async (markId: string) => {
        const mark = marksRef.current.find((item) => item.id === markId)
        const key = mark ? overlayerKeyForMark(mark) : null
        const view = viewRef.current
        if (!mark || !key || !view) return false
        // 经 view 自身逆过程定位（与 getCFI 配对；直接 toRange 会误解 spine 前缀）
        let resolved: { index: number; anchor: (doc: Document) => Range }
        try {
          resolved = view.resolveCFI(key)
        } catch {
          return false
        }
        const target = getRenderedDocs().find((item) => item.index === resolved.index)
        if (!target) return false
        let range: Range
        try {
          range = resolved.anchor(target.doc)
        } catch {
          return false
        }
        return openInspectorAtRange(mark, range)
      },
    }
    return () => {
      delete window.__inkdownE2eReader
    }
  }, [filePath, getRenderedDocs, openInspectorAtRange])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!ready) return
      if (!(event.altKey || event.metaKey)) return
      const { nav: currentNav } = useReaderNavigationStore.getState()
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        const chapter = currentNav.previous
        if (chapter) goToChapter(chapter, currentNav.previousIndex)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        const chapter = currentNav.next
        if (chapter) goToChapter(chapter, currentNav.nextIndex)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goToChapter, ready])

  const { currentUnitId } = useReaderNavTitles()
  const resolveChapter = kindRef.current === 'epub' ? resolveEpubChapter : resolveMobiChapter

  const handleExportNotes = useCallback(
    (contentKind: ReadingNotesContentKind, scope: ReadingNotesScope) => {
      const toc = tocFromEpubUnits(chapters)
      const currentKey = currentUnitId ? normalizeLoadKey(currentUnitId) : ''
      const currentChapter = findCurrentChapterRef(toc, currentKey)
      void saveReadingNotesExport({
        marks,
        toc,
        contentKind,
        scope,
        currentChapter: scope === 'chapter' ? currentChapter : null,
        filePath,
        resolveChapter,
      })
    },
    [chapters, currentUnitId, filePath, marks, resolveChapter],
  )

  const handleExportAnkiCards = useCallback(
    (scope: ReadingNotesScope) => {
      const toc = tocFromEpubUnits(chapters)
      const currentKey = currentUnitId ? normalizeLoadKey(currentUnitId) : ''
      const currentChapter = findCurrentChapterRef(toc, currentKey)
      void saveAnkiCardsExport({
        marks,
        toc,
        scope,
        currentChapter: scope === 'chapter' ? currentChapter : null,
        filePath,
        resolveChapter,
      })
    },
    [chapters, currentUnitId, filePath, marks, resolveChapter],
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
        filePath={filePath}
        marksOpen={marksOpen}
        marks={marks}
        onSelectMark={handleSelectMark}
        onDeleteMark={(mark) => void handleDeleteMark(mark)}
        onCloseMarks={closeMarks}
        onExportNotes={handleExportNotes}
        onExportAnkiCards={handleExportAnkiCards}
        marksToc={tocFromEpubUnits(chapters)}
        marksCurrentChapterKey={currentUnitId ? normalizeLoadKey(currentUnitId) : undefined}
        marksResolveChapter={resolveChapter}
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
        <PaneErrorBoundary name={isEpub ? 'EPUB 阅读' : 'MOBI 阅读'} filePath={filePath}>
          <div
            ref={containerRef}
            className={cn(
              'foliate-reader-host relative h-full min-h-0 overflow-hidden',
              theme === 'dark' ? 'bg-[#18181b]' : 'bg-[#fafafa]',
            )}
            data-theme={theme}
          >
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                正在加载{isEpub ? ' EPUB' : ' MOBI'}…
              </div>
            )}
          </div>
        </PaneErrorBoundary>
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
            void updateMark({ id: inspector.active!.id, color }).then(() => syncVisualMarks())
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
              kind: editingNoteMark.kind === 'highlight' ? 'highlight' : 'note',
            }).then((result) => {
              if (isOk(result)) {
                toast.success(note.trim() ? '已保存批注' : '已清除批注')
                syncVisualMarks()
              }
            })
            return
          }
          void handleSaveAnnotation(note)
        }}
      />
    </div>
  )
}
