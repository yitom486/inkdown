import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface EpubReadingProgress {
  cfi: string
  href?: string
  percentage?: number
  updatedAt: number
}

export interface EpubLocationsCacheEntry {
  fingerprint: string
  chunkSize: number
  locationsJson: string
  updatedAt: number
}

export interface MobiReadingProgress {
  chapterId: string
  updatedAt: number
}

export interface PdfReadingProgress {
  pageNum: number
  updatedAt: number
}

interface ReadingProgressStore {
  epubByFile: Record<string, EpubReadingProgress>
  epubLocationsByFile: Record<string, EpubLocationsCacheEntry>
  mobiByFile: Record<string, MobiReadingProgress>
  pdfByFile: Record<string, PdfReadingProgress>
  getEpubProgress: (filePath: string) => EpubReadingProgress | undefined
  saveEpubProgress: (
    filePath: string,
    progress: Pick<EpubReadingProgress, 'cfi'> &
      Partial<Pick<EpubReadingProgress, 'href' | 'percentage'>>,
  ) => void
  clearEpubProgress: (filePath: string) => void
  getEpubLocations: (filePath: string) => EpubLocationsCacheEntry | undefined
  saveEpubLocations: (
    filePath: string,
    entry: Omit<EpubLocationsCacheEntry, 'updatedAt'>,
  ) => void
  clearEpubLocations: (filePath: string) => void
  getMobiProgress: (filePath: string) => MobiReadingProgress | undefined
  saveMobiProgress: (filePath: string, progress: Pick<MobiReadingProgress, 'chapterId'>) => void
  clearMobiProgress: (filePath: string) => void
  getPdfProgress: (filePath: string) => PdfReadingProgress | undefined
  savePdfProgress: (filePath: string, progress: Pick<PdfReadingProgress, 'pageNum'>) => void
  clearPdfProgress: (filePath: string) => void
}

function normalizeFilePath(filePath: string): string | undefined {
  const normalized = filePath.trim()
  return normalized || undefined
}

export const useReadingProgressStore = create<ReadingProgressStore>()(
  persist(
    (set, get) => ({
      epubByFile: {},
      epubLocationsByFile: {},
      mobiByFile: {},
      pdfByFile: {},

      getEpubProgress: (filePath) => {
        const normalized = normalizeFilePath(filePath)
        if (!normalized) return undefined
        return get().epubByFile[normalized]
      },

      saveEpubProgress: (filePath, progress) => {
        const normalized = normalizeFilePath(filePath)
        const cfi = progress.cfi.trim()
        if (!normalized || !cfi) return

        const prev = get().epubByFile[normalized]
        if (
          prev &&
          prev.cfi === cfi &&
          prev.href === progress.href &&
          prev.percentage === progress.percentage
        ) {
          return
        }

        set((state) => ({
          epubByFile: {
            ...state.epubByFile,
            [normalized]: {
              cfi,
              href: progress.href,
              percentage: progress.percentage,
              updatedAt: Date.now(),
            },
          },
        }))
      },

      clearEpubProgress: (filePath) => {
        const normalized = normalizeFilePath(filePath)
        if (!normalized) return

        set((state) => {
          const next = { ...state.epubByFile }
          delete next[normalized]
          return { epubByFile: next }
        })
      },

      getEpubLocations: (filePath) => {
        const normalized = normalizeFilePath(filePath)
        if (!normalized) return undefined
        return get().epubLocationsByFile[normalized]
      },

      saveEpubLocations: (filePath, entry) => {
        const normalized = normalizeFilePath(filePath)
        if (!normalized || !entry.locationsJson.trim()) return

        const prev = get().epubLocationsByFile[normalized]
        if (
          prev &&
          prev.fingerprint === entry.fingerprint &&
          prev.chunkSize === entry.chunkSize &&
          prev.locationsJson === entry.locationsJson
        ) {
          return
        }

        set((state) => ({
          epubLocationsByFile: {
            ...state.epubLocationsByFile,
            [normalized]: {
              ...entry,
              updatedAt: Date.now(),
            },
          },
        }))
      },

      clearEpubLocations: (filePath) => {
        const normalized = normalizeFilePath(filePath)
        if (!normalized) return

        set((state) => {
          const next = { ...state.epubLocationsByFile }
          delete next[normalized]
          return { epubLocationsByFile: next }
        })
      },

      getMobiProgress: (filePath) => {
        const normalized = normalizeFilePath(filePath)
        if (!normalized) return undefined
        return get().mobiByFile[normalized]
      },

      saveMobiProgress: (filePath, progress) => {
        const normalized = normalizeFilePath(filePath)
        const chapterId = progress.chapterId.trim()
        if (!normalized || !chapterId) return

        const prev = get().mobiByFile[normalized]
        if (prev?.chapterId === chapterId) return

        set((state) => ({
          mobiByFile: {
            ...state.mobiByFile,
            [normalized]: {
              chapterId,
              updatedAt: Date.now(),
            },
          },
        }))
      },

      clearMobiProgress: (filePath) => {
        const normalized = normalizeFilePath(filePath)
        if (!normalized) return

        set((state) => {
          const next = { ...state.mobiByFile }
          delete next[normalized]
          return { mobiByFile: next }
        })
      },

      getPdfProgress: (filePath) => {
        const normalized = normalizeFilePath(filePath)
        if (!normalized) return undefined
        return get().pdfByFile[normalized]
      },

      savePdfProgress: (filePath, progress) => {
        const normalized = normalizeFilePath(filePath)
        if (!normalized || progress.pageNum < 1) return

        const pageNum = Math.floor(progress.pageNum)
        const prev = get().pdfByFile[normalized]
        if (prev?.pageNum === pageNum) return

        set((state) => ({
          pdfByFile: {
            ...state.pdfByFile,
            [normalized]: {
              pageNum,
              updatedAt: Date.now(),
            },
          },
        }))
      },

      clearPdfProgress: (filePath) => {
        const normalized = normalizeFilePath(filePath)
        if (!normalized) return

        set((state) => {
          const next = { ...state.pdfByFile }
          delete next[normalized]
          return { pdfByFile: next }
        })
      },
    }),
    {
      name: 'reader-progress',
      partialize: (state) => ({
        epubByFile: state.epubByFile,
        epubLocationsByFile: state.epubLocationsByFile,
        mobiByFile: state.mobiByFile,
        pdfByFile: state.pdfByFile,
      }),
    },
  ),
)
