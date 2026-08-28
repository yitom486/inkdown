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

interface ReadingProgressStore {
  epubByFile: Record<string, EpubReadingProgress>
  epubLocationsByFile: Record<string, EpubLocationsCacheEntry>
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
}

export const useReadingProgressStore = create<ReadingProgressStore>()(
  persist(
    (set, get) => ({
      epubByFile: {},
      epubLocationsByFile: {},

      getEpubProgress: (filePath) => {
        const normalized = filePath.trim()
        if (!normalized) return undefined
        return get().epubByFile[normalized]
      },

      saveEpubProgress: (filePath, progress) => {
        const normalized = filePath.trim()
        const cfi = progress.cfi.trim()
        if (!normalized || !cfi) return

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
        const normalized = filePath.trim()
        if (!normalized) return

        set((state) => {
          const next = { ...state.epubByFile }
          delete next[normalized]
          return { epubByFile: next }
        })
      },

      getEpubLocations: (filePath) => {
        const normalized = filePath.trim()
        if (!normalized) return undefined
        return get().epubLocationsByFile[normalized]
      },

      saveEpubLocations: (filePath, entry) => {
        const normalized = filePath.trim()
        if (!normalized || !entry.locationsJson.trim()) return

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
        const normalized = filePath.trim()
        if (!normalized) return

        set((state) => {
          const next = { ...state.epubLocationsByFile }
          delete next[normalized]
          return { epubLocationsByFile: next }
        })
      },
    }),
    {
      name: 'reader-progress',
      partialize: (state) => ({
        epubByFile: state.epubByFile,
        epubLocationsByFile: state.epubLocationsByFile,
      }),
    },
  ),
)
