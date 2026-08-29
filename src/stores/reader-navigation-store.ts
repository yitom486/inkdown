import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { EpubChapter, EpubLocationHint } from '@/lib/epub-navigation'
import type { MobiChapterItem } from '@/lib/mobi-navigation'
import {
  EMPTY_READER_NAV,
  syncEpubNavigation,
  syncEpubNavigationFromViewport,
  syncEpubNavigationFromRendition,
  syncMobiNavigation,
  syncMobiNavigationFromViewport,
  syncPdfNavigation,
  type ReaderFormat,
} from '@/lib/reader-navigation-sync'
import type { AdjacentFlatNavState } from '@/lib/reader-chapter-nav'
import { encodeMobiTocHref } from '@/lib/mobi-navigation'
import type { ReaderUnit } from '@/lib/reader-navigation'

function isSameNav(
  a: AdjacentFlatNavState<ReaderUnit>,
  b: AdjacentFlatNavState<ReaderUnit>,
): boolean {
  return (
    a.flatIndex === b.flatIndex &&
    a.currentIndex === b.currentIndex &&
    a.previousIndex === b.previousIndex &&
    a.nextIndex === b.nextIndex &&
    a.current?.label === b.current?.label &&
    a.previous?.label === b.previous?.label &&
    a.next?.label === b.next?.label &&
    a.current?.href === b.current?.href
  )
}

type ReaderNavUnit = ReaderUnit | MobiChapterItem

interface EpubRenditionLike {
  getContents: () => unknown
  currentLocation: () => unknown
}

interface ReaderNavigationStore {
  filePath: string | null
  format: ReaderFormat | null
  units: ReaderNavUnit[]
  nav: AdjacentFlatNavState<ReaderUnit>
  ready: boolean
  beginSession: (filePath: string, format: ReaderFormat) => void
  setUnits: (units: ReaderNavUnit[]) => void
  setReady: (ready: boolean) => void
  syncEpub: (units: EpubChapter[], hint?: EpubLocationHint, flatIndex?: number) => void
  syncEpubViewport: (units: EpubChapter[], document: Document, spineHref: string) => void
  syncEpubRendition: (units: EpubChapter[], rendition: EpubRenditionLike) => void
  syncMobi: (units: MobiChapterItem[], chapterId?: string, flatIndex?: number) => void
  syncMobiViewport: (units: MobiChapterItem[], document: Document, chapterId: string) => void
  syncPdf: (units: ReaderUnit[], pageNum: number) => void
  syncFlatIndex: (flatIndex: number) => void
}

export const useReaderNavigationStore = create<ReaderNavigationStore>((set, get) => ({
  filePath: null,
  format: null,
  units: [],
  nav: EMPTY_READER_NAV,
  ready: false,

  beginSession: (filePath, format) => {
    set({
      filePath,
      format,
      units: [],
      nav: EMPTY_READER_NAV,
      ready: false,
    })
  },

  setUnits: (units) => {
    if (get().units === units) return
    set({ units })
  },

  setReady: (ready) => {
    if (get().ready === ready) return
    set({ ready })
  },

  syncEpub: (units, hint, flatIndex) => {
    const nav = syncEpubNavigation(units, hint, flatIndex)
    const prev = get()
    if (prev.format === 'epub' && prev.units === units && isSameNav(prev.nav, nav)) return
    set({ units, format: 'epub', nav })
  },

  syncEpubViewport: (units, document, spineHref) => {
    const nav = syncEpubNavigationFromViewport(units, document, spineHref)
    const prev = get()
    if (prev.format === 'epub' && isSameNav(prev.nav, nav)) return
    set({ units, format: 'epub', nav })
  },

  syncEpubRendition: (units, rendition) => {
    const nav = syncEpubNavigationFromRendition(units, rendition)
    if (nav.flatIndex < 0) return
    const prev = get()
    if (prev.format === 'epub' && isSameNav(prev.nav, nav)) return
    set({ units, format: 'epub', nav })
  },

  syncMobi: (units, chapterId, flatIndex) => {
    const nav = syncMobiNavigation(units, chapterId, flatIndex)
    const prev = get()
    if (prev.format === 'mobi' && isSameNav(prev.nav, nav)) return
    set({ units, format: 'mobi', nav })
  },

  syncMobiViewport: (units, document, chapterId) => {
    const nav = syncMobiNavigationFromViewport(units, document, chapterId)
    const prev = get()
    if (prev.format === 'mobi' && isSameNav(prev.nav, nav)) return
    set({ units, format: 'mobi', nav })
  },

  syncPdf: (units, pageNum) => {
    const nav = syncPdfNavigation(units, pageNum)
    const prev = get()
    if (prev.format === 'pdf' && prev.units === units && isSameNav(prev.nav, nav)) return
    set({ units, format: 'pdf', nav })
  },

  syncFlatIndex: (flatIndex) => {
    const { format, units, nav: prevNav } = get()
    if (flatIndex < 0 || flatIndex >= units.length) return

    const nav =
      format === 'mobi'
        ? syncMobiNavigation(units as MobiChapterItem[], undefined, flatIndex)
        : syncEpubNavigation(units as EpubChapter[], undefined, flatIndex)

    if (isSameNav(prevNav, nav)) return
    set({ nav })
  },
}))

export function selectReaderNavTitles(state: {
  nav: AdjacentFlatNavState<ReaderUnit>
  format: ReaderFormat | null
}) {
  const { nav, format } = state
  const currentUnitId =
    format === 'mobi' && nav.flatIndex >= 0
      ? encodeMobiTocHref(nav.flatIndex)
      : nav.current?.href

  // 只返回原始值：勿带 nav 对象，否则浅比较失效
  return {
    currentTitle: nav.current?.label ?? '—',
    previousTitle: nav.previous?.label ?? '—',
    nextTitle: nav.next?.label ?? '—',
    previousDisabled: !nav.previous,
    nextDisabled: !nav.next,
    currentUnitId,
  }
}

/** 须用 useShallow：选择器每次返回新对象，否则会 Maximum update depth exceeded */
export function useReaderNavTitles() {
  return useReaderNavigationStore(useShallow(selectReaderNavTitles))
}
