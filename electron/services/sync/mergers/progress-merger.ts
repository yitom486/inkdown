export interface ProgressEntryWithTime {
  updatedAt: number
}

export interface ReadingProgressSnapshot {
  epubByFile?: Record<string, { cfi: string; href?: string; percentage?: number; updatedAt: number }>
  mobiByFile?: Record<string, { chapterId: string; updatedAt: number }>
  pdfByFile?: Record<string, { pageNum: number; updatedAt: number }>
  webByUrl?: Record<string, { scrollRatio: number; updatedAt: number }>
}

export interface ProgressMergeResult {
  merged: ReadingProgressSnapshot
  updatedCount: number
}

function mergeDict<T extends ProgressEntryWithTime>(
  localDict?: Record<string, T>,
  remoteDict?: Record<string, T>,
): { merged: Record<string, T>; updated: number } {
  const local = localDict ?? {}
  const remote = remoteDict ?? {}
  const allKeys = new Set([...Object.keys(local), ...Object.keys(remote)])
  const merged: Record<string, T> = {}
  let updated = 0

  for (const key of allKeys) {
    const localVal = local[key]
    const remoteVal = remote[key]

    if (localVal && remoteVal) {
      if (remoteVal.updatedAt > localVal.updatedAt) {
        merged[key] = remoteVal
        updated += 1
      } else {
        merged[key] = localVal
      }
    } else if (remoteVal) {
      merged[key] = remoteVal
      updated += 1
    } else {
      merged[key] = localVal!
    }
  }

  return { merged, updated }
}

/**
 * 阅读进度双向时间戳仲裁合并（EPUB、MOBI、PDF、在线文档）
 */
export function mergeReadingProgress(
  local: ReadingProgressSnapshot,
  remote: ReadingProgressSnapshot,
): ProgressMergeResult {
  const epub = mergeDict(local.epubByFile, remote.epubByFile)
  const mobi = mergeDict(local.mobiByFile, remote.mobiByFile)
  const pdf = mergeDict(local.pdfByFile, remote.pdfByFile)
  const web = mergeDict(local.webByUrl, remote.webByUrl)

  return {
    merged: {
      epubByFile: epub.merged,
      mobiByFile: mobi.merged,
      pdfByFile: pdf.merged,
      webByUrl: web.merged,
    },
    updatedCount: epub.updated + mobi.updated + pdf.updated + web.updated,
  }
}
