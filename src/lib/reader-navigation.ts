export type {
  EpubChapter as ReaderUnit,
  EpubChapterNavState as ReaderUnitNavState,
  EpubTocSource as ReaderTocSource,
} from '@/lib/epub-navigation'

export {
  flattenEpubToc as flattenReaderToc,
  isTocLikeChapter,
  pickInitialChapter,
  resolveChapterNav as resolveUnitNav,
} from '@/lib/epub-navigation'
