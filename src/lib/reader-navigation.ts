export type {
  EpubChapter as ReaderUnit,
  EpubChapterNavState as ReaderUnitNavState,
  EpubTocSource as ReaderTocSource,
} from '@/lib/epub-navigation'

export {
  flattenEpubToc as flattenReaderToc,
  findLastEpubFlatIndex,
  isTocLikeChapter,
  pickInitialChapter,
  resolveChapterNav as resolveUnitNav,
} from '@/lib/epub-navigation'

export { pickReaderNavLevel, resolveReaderChapterNav } from '@/lib/reader-chapter-nav'
