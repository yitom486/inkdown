export type {
  EpubChapter as ReaderUnit,
  EpubChapterNavState as ReaderUnitNavState,
  EpubTocSource as ReaderTocSource,
} from '@/lib/epub-navigation'

export {
  flattenEpubToc as flattenReaderToc,
  findEpubFlatIndex,
  findLastEpubFlatIndex,
  isTocLikeChapter,
  pickInitialChapter,
  resolveChapterNav as resolveUnitNav,
  type EpubLocationHint,
} from '@/lib/epub-navigation'

export {
  findNextDistinctLoadTarget,
  findPreviousDistinctLoadTarget,
  pickReaderNavLevel,
  resolveAdjacentFlatNav,
  resolveReaderChapterNav,
} from '@/lib/reader-chapter-nav'

export {
  decodeMobiTocHref,
  encodeMobiTocHref,
  MOBI_TOC_HREF_PREFIX,
} from '@/lib/mobi-navigation'
