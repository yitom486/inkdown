import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AutoSaveIntervalMs = 15000 | 30000 | 60000

export const AUTO_SAVE_INTERVAL_OPTIONS: Array<{ value: AutoSaveIntervalMs; label: string }> = [
  { value: 15000, label: '15 秒' },
  { value: 30000, label: '30 秒' },
  { value: 60000, label: '60 秒' },
]

export const RECENT_FILES_LIMIT_OPTIONS = [5, 10, 20] as const
export type RecentFilesLimit = (typeof RECENT_FILES_LIMIT_OPTIONS)[number]

export interface AppSettingsState {
  autoSaveEnabled: boolean
  autoSaveIntervalMs: AutoSaveIntervalMs
  maxRecentFiles: RecentFilesLimit
  recentFiles: string[]
}

interface AppSettingsStore extends AppSettingsState {
  setAutoSaveEnabled: (enabled: boolean) => void
  setAutoSaveIntervalMs: (intervalMs: AutoSaveIntervalMs) => void
  setMaxRecentFiles: (limit: RecentFilesLimit) => void
  addRecentFile: (filePath: string) => void
  removeRecentFile: (filePath: string) => void
  clearRecentFiles: () => void
}

function trimRecentFiles(files: string[], limit: number): string[] {
  return files.slice(0, Math.max(1, limit))
}

export const useAppSettingsStore = create<AppSettingsStore>()(
  persist(
    (set) => ({
      autoSaveEnabled: false,
      autoSaveIntervalMs: 30000,
      maxRecentFiles: 10,
      recentFiles: [],

      setAutoSaveEnabled: (enabled) => set({ autoSaveEnabled: enabled }),

      setAutoSaveIntervalMs: (intervalMs) => set({ autoSaveIntervalMs: intervalMs }),

      setMaxRecentFiles: (limit) =>
        set((state) => ({
          maxRecentFiles: limit,
          recentFiles: trimRecentFiles(state.recentFiles, limit),
        })),

      addRecentFile: (filePath) =>
        set((state) => {
          const normalized = filePath.trim()
          if (!normalized) return state

          const next = [normalized, ...state.recentFiles.filter((item) => item !== normalized)]
          return {
            recentFiles: trimRecentFiles(next, state.maxRecentFiles),
          }
        }),

      removeRecentFile: (filePath) =>
        set((state) => ({
          recentFiles: state.recentFiles.filter((item) => item !== filePath),
        })),

      clearRecentFiles: () => set({ recentFiles: [] }),
    }),
    {
      name: 'markdown-editor-settings',
      partialize: (state) => ({
        autoSaveEnabled: state.autoSaveEnabled,
        autoSaveIntervalMs: state.autoSaveIntervalMs,
        maxRecentFiles: state.maxRecentFiles,
        recentFiles: state.recentFiles,
      }),
    },
  ),
)
