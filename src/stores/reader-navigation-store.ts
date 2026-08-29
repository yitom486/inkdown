import { create } from 'zustand'
import type { EpubChapter, EpubLocationHint } from '@/lib/epub-navigation'
import type { MobiChapterItem } from '@/lib/mobi-navigation'
import {
  EMPTY_READER_NAV,
  syncEpubNavigation,
  syncEpubNavigationFromViewport,
  syncEpubNavigationFromRendition,
  syncMobiNavigation,
  syncPdfNavigation,
  type ReaderFormat,
} from '@/lib/reader-navigation-sync'
import type { AdjacentFlatNavState } from '@/lib/reader-chapter-nav'
import { encodeMobiTocHref } from '@/lib/mobi-navigation'
import type { ReaderUnit } from '@/lib/reader-navigation'

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

  setUnits: (units) => set({ units }),

  setReady: (ready) => set({ ready }),

  syncEpub: (units, hint, flatIndex) => {
    set({
      units,
      format: 'epub',
      nav: syncEpubNavigation(units, hint, flatIndex),
    })
  },

  syncEpubViewport: (units, document, spineHref) => {
    set({
      units,
      format: 'epub',
      nav: syncEpubNavigationFromViewport(units, document, spineHref),
    })
  },

  syncEpubRendition: (units, rendition) => {
    const nav = syncEpubNavigationFromRendition(units, rendition)
    if (nav.flatIndex < 0) return
    set({
      units,
      format: 'epub',
      nav,
    })
  },

  syncMobi: (units, chapterId, flatIndex) => {
    set({
      units,
      format: 'mobi',
      nav: syncMobiNavigation(units, chapterId, flatIndex),
    })
  },

  syncPdf: (units, pageNum) => {
    set({
      units,
      format: 'pdf',
      nav: syncPdfNavigation(units, pageNum),
    })
  },

  syncFlatIndex: (flatIndex) => {
    const { format, units } = get()
    if (flatIndex < 0 || flatIndex >= units.length) return

    if (format === 'mobi') {
      set({ nav: syncMobiNavigation(units as MobiChapterItem[], undefined, flatIndex) })
      return
    }

    set({ nav: syncEpubNavigation(units as EpubChapter[], undefined, flatIndex) })
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

  return {
    currentTitle: nav.current?.label ?? '—',
    previousTitle: nav.previous?.label ?? '—',
    nextTitle: nav.next?.label ?? '—',
    previousDisabled: !nav.previous,
    nextDisabled: !nav.next,
    currentUnitId,
    nav,
  }
}

export function useReaderNavTitles() {
  return useReaderNavigationStore(selectReaderNavTitles)
}
