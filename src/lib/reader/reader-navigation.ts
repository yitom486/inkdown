export type {
  EpubChapter as ReaderUnit,
  EpubChapterNavState as ReaderUnitNavState,
  EpubTocSource as ReaderTocSource,
} from '@/lib/reader/epub-navigation'

export {
  flattenEpubToc as flattenReaderToc,
  findEpubFlatIndex,
  isTocLikeChapter,
  pickInitialChapter,
  resolveChapterNav as resolveUnitNav,
  type EpubLocationHint,
} from '@/lib/reader/epub-navigation'

export {
  findNextDistinctLoadTarget,
  findPreviousDistinctLoadTarget,
  pickReaderNavLevel,
  resolveAdjacentFlatNav,
  resolveReaderChapterNav,
} from '@/lib/reader/reader-chapter-nav'

export {
  decodeMobiTocHref,
  encodeMobiTocHref,
  MOBI_TOC_HREF_PREFIX,
} from '@/lib/reader/mobi-navigation'
